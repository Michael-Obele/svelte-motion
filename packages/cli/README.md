# @svelte-motion/cli

[![npm](https://img.shields.io/npm/v/@svelte-motion/cli?style=flat-square&color=6366f1)](https://www.npmjs.com/package/@svelte-motion/cli)
[![CI](https://github.com/Michael-Obele/svelte-motion/actions/workflows/ci.yml/badge.svg?branch=main&style=flat-square)](https://github.com/Michael-Obele/svelte-motion/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Bun](https://img.shields.io/badge/requires-Bun%201.3%2B-000000?style=flat-square&logo=bun&logoColor=white)](https://bun.sh)
[![FFmpeg](https://img.shields.io/badge/requires-FFmpeg%20on%20PATH-007808?style=flat-square&logo=ffmpeg&logoColor=white)](#)

Command line interface for rendering Svelte compositions to video.

## Install

```bash
bun add -g @svelte-motion/cli
# or run without installing
bunx @svelte-motion/cli --help
```

Requires `ffmpeg` on PATH and a built Studio. Playwright Chromium is installed with `bunx playwright install chromium`.

## Usage

```bash
svelte-motion: render Svelte compositions to video

Usage: svelte-motion <command> [options]

Commands:
  list    List available compositions
  render  Render a composition to video

Options:
  --help, -h         Show help
  --build <dir>      Build directory (default: build, try --build apps/studio/build in this monorepo)

Examples:
  svelte-motion list --build apps/studio/build
  svelte-motion render hello-world --out out/hello-world.mp4 --build apps/studio/build

Run svelte-motion <command> --help for command-specific help.
```

### list

```bash
svelte-motion list: list available compositions

Usage: svelte-motion list [--build <dir>] [--json]

Options:
  --build <dir>      Build directory (default: build, try --build apps/studio/build in this monorepo)
  --json             Output as JSON
  --help, -h         Show help

Examples:
  svelte-motion list --build apps/studio/build
  svelte-motion list --json --build apps/studio/build
```

Lists every composition the build registered. Text output is one line per composition: `<id>  <width>x<height>  <fps>fps  <frames> frames`. JSON output is an array of `{ id, width, height, fps, durationInFrames, defaultProps? }`.

### render

```bash
svelte-motion render: render a composition to video or an animated GIF

Usage: svelte-motion render <id> --out <file> [options]

Arguments:
  <id>               Composition id (e.g. hello-world)

Options:
  --out <file>       Output file (required). The extension picks the format:
                     .mp4 .mov .mkv -> H.264, .webm -> VP9, .gif -> animated GIF
  --build <dir>      Build directory (default: build, try --build apps/studio/build in this monorepo)
  --props <json>     Props as JSON string
  --concurrency <n>  Parallel chunks (default: 1)
  --crf <n>          Quality, lower is better (default: 18 for H.264, 32 for VP9)
  --codec <str>      Video codec (default: libx264, or libvpx-vp9 for .webm)
  --preset <str>     Encoder preset, MP4 only (default: medium)
  --port <n>         Server port (default: 0, OS-assigned)
  --help, -h         Show help

A GIF is capped at 1280px wide and 15fps, and quantised to a 128-colour
palette. --crf, --codec and --preset do not apply to it.

Examples:
  svelte-motion render hello-world --out out/hello-world.mp4 --build apps/studio/build
  svelte-motion render hello-world --out out/hello-world.gif --build apps/studio/build
  svelte-motion render hello-world --out out.mp4 --props '{"title":"Hi"}' --concurrency 2 --build apps/studio/build
```

| Flag            | Type        | Default   | Notes                                                     |
| --------------- | ----------- | --------- | --------------------------------------------------------- |
| `--out`         | string      | required  | Output path; the extension picks the format               |
| `--build`       | string      | `build`   | Build directory, use `apps/studio/build` in this monorepo |
| `--props`       | JSON string |           | Props object, must be a JSON object not an array          |
| `--concurrency` | number      | `1`       | Parallel chunks, must be at least 1                       |
| `--crf`         | number      | `18`      | H.264 quality 0 to 51, lower is better (VP9: 32)          |
| `--codec`       | string      | `libx264` | Video codec for FFmpeg `-c:v`                             |
| `--preset`      | string      | `medium`  | Encoder preset, MP4 only                                  |
| `--port`        | number      | `0`       | Build server port, 0 is OS assigned                       |

### Formats

The output extension picks the encoder:

| Extension            | Format | Notes                                                                                              |
| -------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| `.mp4` `.mov` `.mkv` | H.264  | The default. `--crf`, `--codec` and `--preset` apply.                                              |
| `.webm`              | VP9    | Same support as a GIF in every modern browser, a fraction of the bytes. `--crf` defaults to 32.    |
| `.gif`               | GIF    | Palette-quantised, capped at 1280px wide and 15fps. `--crf`, `--codec` and `--preset` are ignored. |

An extension in none of those lists fails before the render starts, rather than after every frame has been captured.

## Examples

List compositions:

```bash
svelte-motion list --build apps/studio/build
# hello-world  1920x1080  30fps  90 frames
# fixture-font-heavy  1920x1080  30fps  60 frames
```

Render with default props:

```bash
svelte-motion render hello-world --out out/hello-world.mp4 --build apps/studio/build
```

Render with custom props and concurrency:

```bash
svelte-motion render hello-world --out out/hello-world.mp4 --build apps/studio/build --props '{"title":"Hi"}' --concurrency 2
```

From the monorepo without a global install:

```bash
bun packages/cli/src/index.ts render hello-world --out out/video.mp4 --build apps/studio/build
bun packages/cli/src/index.ts list --build apps/studio/build
bun packages/cli/src/index.ts --help
bun packages/cli/src/index.ts render --help
```

## Exit codes

- `0` success, help, or list with results
- `1` error: missing build, unknown composition, invalid flag, ffmpeg missing, frame never ready, FFmpeg failure, invalid JSON for `--props`

Expected failures print `error: ...` once. Set `SM_DEBUG=1` to include a stack trace.

## Requirements

- `ffmpeg` on PATH. Install with `apt install ffmpeg` or `brew install ffmpeg`.
- A built Studio at the build directory. Build it with `vp run studio#build`.

## License

MIT
