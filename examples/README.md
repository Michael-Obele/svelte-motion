# Examples

Seven compositions that show what the engine does. They are not a separate app: the
studio owns the render host, so each example is a folder with a Svelte component and an
`index.ts` that calls `defineComposition`. The studio, the CLI, and the test suite all
read them from here.

| Id              | Frames | Styling  | What it shows                                                                                                |
| --------------- | ------ | -------- | ------------------------------------------------------------------------------------------------------------ |
| `title-card`    | 90     | scoped   | Spring entrance, a rule that draws with `interpolate`, staged timing with `Sequence`, and a timed exit       |
| `lower-third`   | 120    | scoped   | A graphic sliding in and out inside one `Sequence`, with the exit computed from the local frame              |
| `image-gallery` | 120    | scoped   | Three images cross-fading, slow scale on each, `prefetch` before the first frame                             |
| `data-chart`    | 150    | scoped   | Bars from a JSON file fetched under `delayRender`, staggered springs, counted labels, a valibot props schema |
| `stat-grid`     | 120    | Tailwind | Four cards on a grid, staggered springs, numbers that count up                                               |
| `quote-series`  | 150    | Tailwind | `Series` stepping through a quote, each item revealing one more line                                         |
| `loop-ticker`   | 120    | Tailwind | `Loop` driving an endless horizontal ticker with no timer                                                    |

Static files used by the examples live in `apps/studio/static/examples/`.

## Why the folder has its own config

`examples/svelte.config.js` and `examples/tsconfig.json` exist so editors and
`svelte-check` treat this folder as a Svelte project. Without them, tooling walks up to
the repo root, finds a `vite.config.ts` with no Svelte plugin, and reports:

```
Error: No Svelte configuration found in vite config. Is @sveltejs/vite-plugin-svelte configured?
```

## Run the commands from the repo root

Every command below assumes your shell is at the repository root:

```bash
cd /path/to/svelte-motion
```

Two reasons. The CLI is invoked as `packages/cli/src/index.ts`, and `--build` is relative
to where you are. Running from inside `examples/` only works with `../` prefixes.

### See them in the studio

```bash
vp run studio#dev
```

Then open the printed URL, usually `http://localhost:5173`, and pick a composition from
the sidebar. The preview scales the stage to the panel, so a 1920x1080 composition is
visible in full without scrolling. The scrubber and timeline work on every example.

Stop the server with `Ctrl+C`.

### Render one to a file

```bash
vp run studio#build
bun packages/cli/src/index.ts render title-card --out out/title-card.mp4 --build apps/studio/build
```

`vp run studio#build` is required first: the renderer serves the built app, not the source.
Swap `title-card` for any id in the table. Output lands where `--out` says; `out/` is
gitignored.

### List what is available

```bash
bun packages/cli/src/index.ts list --build apps/studio/build
```

### Pass props

```bash
bun packages/cli/src/index.ts render title-card --out out/card.mp4 \
  --props '{"title":"Release 0.1","subtitle":"What changed"}' \
  --build apps/studio/build
```

`data-chart` declares a valibot schema, so bad values fail before any frame is captured:

```bash
bun packages/cli/src/index.ts render data-chart --out out/chart.mp4 \
  --props '{"heading":""}' --build apps/studio/build
# error: Composition "data-chart" props are invalid: heading: Invalid length: Expected >=1 but received 0
```

Examples without a schema accept any JSON object and ignore unknown keys.

### Check the examples

```bash
cd examples && bunx svelte-check --output human
```

Use `bunx`, not a bare `svelte-check`: the binary is not installed at this level, and
`bunx` resolves it from the workspace. This exits with `0 errors and 0 warnings`.

## Rules for new examples

- A frame is a pure function of its number. No `Math.random`, no `Date.now`, no CSS
  transitions or CSS animations, because those run on wall clock and break renders.
- Assets go in `apps/studio/static/examples/` and are read through `staticFile`.
- Async work (fetch, media) is wrapped in `delayRender` / `continueRender`, so the
  renderer waits for it before the first screenshot.
- Tailwind examples get their utilities because `apps/studio/src/app.css` contains
  `@source "../../../examples"`. Add another folder there if you create one elsewhere.
- Named prop types live in `props.ts`. `svelte-check` cannot see named exports from a
  `.svelte` file.
