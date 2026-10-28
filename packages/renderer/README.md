# @svelte-motion/renderer

[![npm](https://img.shields.io/npm/v/@svelte-motion/renderer?style=flat-square&color=6366f1)](https://www.npmjs.com/package/@svelte-motion/renderer)
[![CI](https://github.com/Michael-Obele/svelte-motion/actions/workflows/ci.yml/badge.svg?branch=main&style=flat-square)](https://github.com/Michael-Obele/svelte-motion/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Node only](https://img.shields.io/badge/runtime-Node%20only-339933?style=flat-square&logo=nodedotjs&logoColor=white)](#)
[![FFmpeg](https://img.shields.io/badge/requires-FFmpeg%20on%20PATH-007808?style=flat-square&logo=ffmpeg&logoColor=white)](#)

Node-only engine that turns a built Studio into an MP4. Serves the build, drives headless Chromium, screenshots each frame, and pipes PNGs to FFmpeg.

Browser code lives in `@svelte-motion/core`. This package must never be imported in a browser bundle.

## Install

```bash
bun add @svelte-motion/renderer
```

Requirements: `ffmpeg` on PATH and Playwright Chromium (`bunx playwright install chromium`).

## Quickstart

```ts
import { renderComposition } from "@svelte-motion/renderer";

const result = await renderComposition({
  buildDir: "apps/studio/build",
  compositionId: "hello-world",
  out: "out/hello-world.mp4",
});

console.log(result);
// { frameCount: 90, fps: 30, outputFps: 30, width: 1920, height: 1080, durationInFrames: 90,
//   format: "mp4", out: "out/hello-world.mp4", warnings: [], readyMs: 123 }
```

## Pipeline

Five steps, every render:

1. Serve the build directory with `Bun.serve` on `127.0.0.1` with SPA fallback to `index.html`.
2. Open `/render?composition=<id>&frame=0&props=<json>` in headless Chromium.
3. Await `window.svelteMotion_setFrame(n)` which resolves after Svelte flush and paint.
4. Screenshot the composition clip at its `width` and `height`.
5. Pipe PNGs to FFmpeg via `image2pipe` and encode to MP4.

## API

### Build server

```ts
import { serveBuild } from "@svelte-motion/renderer";
const server = await serveBuild(buildDir, port);
// server.url, server.port, server.stop()
```

| Export       | Signature                                                   | Notes                                                                                                                                                                                                     |
| ------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `serveBuild` | `(buildDir: string, port?: number) => Promise<BuildServer>` | Serves `buildDir` on loopback. Port `0` asks the OS for a free port. Rejects if `index.html` is missing. `BuildServer` is `{ url, port, stop }`. Unknown paths fall back to `index.html` for SPA routing. |

### Browser

```ts
import { launchBrowser, CHROMIUM_DETERMINISM_FLAGS } from "@svelte-motion/renderer";
```

| Export                                             | Purpose                                                                                                                                                  |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `launchBrowser()`                                  | Launches headless Chromium with determinism flags. Caller owns `close()`.                                                                                |
| `CHROMIUM_DETERMINISM_FLAGS`                       | Flags that keep two runs byte identical: `--disable-lcd-text, --font-render-hinting=none, --force-color-profile=srgb, --disable-gpu, --hide-scrollbars`. |
| `DEFAULT_READY_TIMEOUT_MS`                         | Default ready timeout, `30000`.                                                                                                                          |
| `gotoComposition(page, url, id, props?)`           | Navigates to `/render?composition=<id>&frame=0` without waiting for readiness. Waits for the composition registry bridge.                                |
| `waitForReady(page, timeoutMs, id?, frame?)`       | Polls `window.svelteMotion_ready()` until true or timeout. Includes pending handles in the error.                                                        |
| `waitForReadyAndFonts(page, id, timeoutMs)`        | `waitForReady` plus `document.fonts.ready`.                                                                                                              |
| `openComposition(page, url, id, props, timeoutMs)` | `gotoComposition` plus `waitForReadyAndFonts`.                                                                                                           |
| `hasCompositionBridge(page)`                       | True when `window.svelteMotion_getCompositions` exists.                                                                                                  |
| `getCompositionsFromPage(page)`                    | Reads the registry the page publishes, projected to `PageComposition`.                                                                                   |
| `captureFrame(page, frame, size, timeoutMs, id?)`  | Calls `window.svelteMotion_setFrame(frame)`, waits for ready and fonts, screenshots the clip. Returns PNG bytes.                                         |

Types: `PageComposition { id, width, height, fps, durationInFrames, defaultProps? }`, `FrameSize { width, height }`.

### FFmpeg

```ts
import { checkFfmpeg, buildFfmpegArgs, encodeWithFFmpeg } from "@svelte-motion/renderer";
```

| Export                              | Signature                                        | Notes                                                                                                                |
| ----------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| `checkFfmpeg()`                     | `() => Promise<boolean>`                         | True when `ffmpeg -version` exits 0.                                                                                 |
| `buildFfmpegArgs(options)`          | `(EncodeOptions) => string[]`                    | Builds argv for `image2pipe` input. Order is load bearing, `-framerate` before `-i pipe:0`. Includes bitexact flags. |
| `encodeWithFFmpeg(frames, options)` | `(Uint8Array[], EncodeOptions) => Promise<void>` | Pipes PNGs to FFmpeg stdin. Throws with tail of stderr on failure.                                                   |
| `inferOutputFormat(out)`            | `(string) => OutputFormat`                       | Reads `mp4`, `webm` or `gif` off the extension; throws naming the ones it knows.                                     |
| `resolveGifFps(options)`            | `(EncodeOptions) => number`                      | The rate a GIF will really run at, after the frame-dropping filter.                                                  |

`EncodeOptions { out, fps, crf?, codec?, preset?, format?, gif?, width? }`. The format comes from `format`, or from `out`'s extension: `.mp4`/`.mov`/`.mkv` → H.264 (`crf 18`, `codec libx264`, `preset medium`, `pix_fmt yuv420p`), `.webm` → VP9 (`crf 32`, constant-quality via `-b:v 0`), `.gif` → an animated GIF (`maxColors 128`, `fps` capped at 15, `width` capped at 1280; `crf`/`codec`/`preset` do not apply).

### Chunking

```ts
import { chunkRange } from "@svelte-motion/renderer";
chunkRange(0, 90, 2); // [{ start: 0, end: 45 }, { start: 45, end: 90 }]
```

Splits `[start, end)` into contiguous non overlapping ranges for parallel capture. Remainder is distributed over the first chunks. Empty or inverted ranges return `[]`. Concurrency below 1 is treated as 1.

### Render

```ts
import { renderComposition } from "@svelte-motion/renderer";
```

`RenderOptions`:

| Field            | Type                      | Default   | Notes                                              |
| ---------------- | ------------------------- | --------- | -------------------------------------------------- |
| `buildDir`       | `string`                  | required  | Directory holding the built Studio                 |
| `compositionId`  | `string`                  | required  | Registry id, for example `hello-world`             |
| `out`            | `string`                  | required  | Destination path; the extension picks the format   |
| `props`          | `Record<string, unknown>` |           | Passed through `?props=` as URL encoded JSON       |
| `port`           | `number`                  | `0`       | Build server port, 0 is OS assigned                |
| `concurrency`    | `number`                  | `1`       | Parallel chunks, each gets its own browser context |
| `crf`            | `number`                  | `18`      | Quality, lower is better (VP9: 32)                 |
| `codec`          | `string`                  | `libx264` | Video codec for `-c:v`                             |
| `preset`         | `string`                  | `medium`  | Encoder preset, MP4 only                           |
| `format`         | `OutputFormat`            |           | Forces `mp4`, `webm` or `gif` over the extension   |
| `gif`            | `GifOptions`              |           | `{ maxColors?, fps?, width? }`, GIF only           |
| `readyTimeoutMs` | `number`                  | `30000`   | How long to wait for readiness per frame           |
| `onProgress`     | `(done, total) => void`   |           | Called after each captured frame                   |

`RenderResult { frameCount, fps, width, height, durationInFrames, out, format, outputFps, warnings, readyMs }`. `outputFps` is the rate actually written — a GIF is capped, so it can be below `fps`. Warnings are deduped `[svelte-motion]` console messages, capped at 50. `readyMs` is time spent waiting for readiness during the probe.

Errors: missing ffmpeg, an output extension that names no known format (before the browser ever launches), unknown composition id (lists available ids), page never booted (no registry bridge), props validation failure, frame never ready (names pending handles), FFmpeg non zero exit.

## Determinism

Two renders of the same composition must produce byte identical MP4s. Three things make that possible:

- Chromium flags disable LCD subpixel antialiasing and force sRGB and no GPU compositing.
- FFmpeg flags ` -map_metadata -1 -fflags +bitexact -flags:v +bitexact` stop the muxer from stamping creation time and encoder version.
- The renderer waits for `window.svelteMotion_ready()` and `document.fonts.ready` before every screenshot, including after each `setFrame`.

The M0 gate checks this by screenshotting frame 0 and frame 90 twice and comparing bytes.

## Requirements

- `ffmpeg` on PATH. Install with `apt install ffmpeg` or `brew install ffmpeg`.
- Playwright Chromium. Install with `bunx playwright install chromium`.

## Limits

- Concurrency defaults to 1. Higher values cost one browser context per chunk.
- Video only. Audio elements are not muxed into the output in v1.
- The build server binds to `127.0.0.1` only.

## License

MIT
