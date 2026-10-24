# @svelte-motion/cli

Command line interface for rendering Svelte compositions to video.

## Install

```bash
bun add -g @svelte-motion/cli
# or run without installing
bunx @svelte-motion/cli --help
```

Requires `ffmpeg` on PATH and a built Studio. Playwright Chromium is installed with `bunx playwright install chromium`.

## Usage

```
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

```
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

```
svelte-motion render: render a composition to video

Usage: svelte-motion render <id> --out <file> [options]

Arguments:
  <id>               Composition id (e.g. hello-world)

Options:
  --out <file>       Output file (required)
  --build <dir>      Build directory (default: build, try --build apps/studio/build in this monorepo)
  --props <json>     Props as JSON string
  --concurrency <n>  Parallel chunks (default: 1)
  --crf <n>          H.264 quality (default: 18)
  --codec <str>      Video codec (default: libx264)
  --preset <str>     Encoder preset (default: medium)
  --port <n>         Server port (default: 0, OS-assigned)
  --help, -h         Show help

Examples:
  svelte-motion render hello-world --out out/hello-world.mp4 --build apps/studio/build
  svelte-motion render hello-world --out out.mp4 --props '{"title":"Hi"}' --concurrency 2 --build apps/studio/build
```

| Flag            | Type        | Default   | Notes                                                     |
| --------------- | ----------- | --------- | --------------------------------------------------------- |
| `--out`         | string      | required  | Output MP4 path                                           |
| `--build`       | string      | `build`   | Build directory, use `apps/studio/build` in this monorepo |
| `--props`       | JSON string |           | Props object, must be a JSON object not an array          |
| `--concurrency` | number      | `1`       | Parallel chunks, must be at least 1                       |
| `--crf`         | number      | `18`      | H.264 quality 0 to 51, lower is better                    |
| `--codec`       | string      | `libx264` | Video codec for FFmpeg `-c:v`                             |
| `--preset`      | string      | `medium`  | Encoder preset                                            |
| `--port`        | number      | `0`       | Build server port, 0 is OS assigned                       |

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
