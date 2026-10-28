# Examples

Eight compositions, in a **normal SvelteKit app**. This is the setup you have after
`bun add @svelte-motion/core @svelte-motion/studio-ui`: a scaffolded Kit project, Tailwind,
and a `src/lib/compositions` folder you own.

It is deliberately not special. It installs `@svelte-motion/core` from the package, so it
resolves through the real `exports` map to `dist` — which means a broken `exports` entry or
a missing `.d.ts` fails here and nowhere else. `apps/studio` aliases core to source instead,
so the two apps exercise opposite halves of the package.

| Id              | Frames | Styling  | What it shows                                                                                                                                              |
| --------------- | ------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title-card`    | 90     | scoped   | Spring entrance, a rule that draws with `interpolate`, staged timing with `Sequence`, and a timed exit                                                     |
| `lower-third`   | 120    | scoped   | A graphic sliding in and out inside one `Sequence`, with the exit computed from the local frame                                                            |
| `image-gallery` | 120    | scoped   | Three images cross-fading, slow scale on each, `prefetch` before the first frame                                                                           |
| `data-chart`    | 150    | scoped   | Bars from a JSON file fetched under `delayRender`, staggered springs, counted labels, a valibot props schema                                               |
| `stat-grid`     | 120    | Tailwind | Four cards on a grid, staggered springs, numbers that count up                                                                                             |
| `quote-series`  | 150    | Tailwind | `Series` stepping through a quote, each item revealing one more line                                                                                       |
| `loop-ticker`   | 120    | Tailwind | `Loop` driving an endless horizontal ticker with no timer                                                                                                  |
| `banner`        | 90     | scoped   | The svelte-motion banner as one inline SVG, ping-ponging so a loop has no seam; `bun run banner` renders it to `assets/banner.gif` and `assets/banner.mp4` |

## Layout

```
src/lib/compositions/<id>/   one folder per example: <Name>.svelte, props.ts, index.ts
src/routes/+page.svelte      gallery — a card per composition
src/routes/[id]/+page.svelte one composition in the Studio
src/routes/render/           /render host the CLI screenshots
src/routes/player/           /player host the parity gate screenshots
src/app.css                  Tailwind + the studio theme tokens
static/examples/             chart-data.json and the gallery SVGs
```

Each `index.ts` calls `defineComposition`, which is all the registry needs. The app globs
that folder itself (`import.meta.glob("/src/lib/compositions/*/index.ts")`) — `src/routes`
and the glob are the app's job, which is exactly why `@svelte-motion/studio-ui` is a
component library and not an app.

## Commands

Run these from the repository root. The CLI is invoked by path and `--build` is relative to
where you are.

```bash
# Gallery + Studio. Builds core first, because this app uses core's dist.
bun run dev:examples

# Render one to a file. Same ordering: core, then this app.
bun run build:examples
bun packages/cli/src/index.ts render title-card --out out/title-card.mp4 --build examples/build

# List what this app registers
bun packages/cli/src/index.ts list --build examples/build

# Type-check the app
bun run check:examples
```

If you change `packages/core`, rebuild it before the app will see the change:

```bash
vp run core#build
```

That is the trade you make for testing the published entry points. `apps/studio` avoids it
by aliasing core to source.

### Pass props

```bash
bun packages/cli/src/index.ts render title-card --out out/card.mp4 \
  --props '{"title":"Release 0.1","subtitle":"What changed"}' \
  --build examples/build
```

`data-chart` declares a valibot schema, so bad values fail before any frame is captured:

```bash
bun packages/cli/src/index.ts render data-chart --out out/chart.mp4 \
  --props '{"heading":""}' --build examples/build
# error: Composition "data-chart" props are invalid: heading: Invalid length: Expected >=1 but received 0
```

Examples without a schema accept any JSON object and ignore unknown keys.

## Adding an example

1. Create `src/lib/compositions/<id>/` with `<Name>.svelte`, `props.ts`, and `index.ts`
   calling `defineComposition`.
2. Done. The glob picks it up; there is no registry file to edit.

Rules:

- A frame is a pure function of its number. No `Math.random`, no `Date.now`, no CSS
  transitions or animations — those run on wall clock and break determinism.
- Assets go in `static/examples/` here and are read through `staticFile("examples/...")`.
  A static file is served by the app that owns it, so examples used to live in
  `apps/studio/static/`; they no longer do.
- Async work (fetch, media) is wrapped in `delayRender` / `continueRender`, so the renderer
  waits for it before the first screenshot.
- Tailwind utilities work because `src/app.css` has `@source "../../packages/studio-ui/src"`.
  If you add markup in another folder outside this app, add its `@source` too.
- Named prop types live in `props.ts`. `svelte-check` cannot see named exports from a
  `.svelte` file.

## Note on the editor

`svelte` must resolve from this folder. It does: this app is a workspace member with its own
`node_modules`. If resolution ever breaks, the Svelte VS Code extension falls back to the
Svelte 4 parser bundled inside `svelte-language-server` and reports nonsense on valid runes
code:

```
Expected if, each or await
```

Nothing here is wrong when that appears — `{#snippet}` is Svelte 5 syntax that parser does
not know. Check `require.resolve('svelte/compiler', { paths: ['examples'] })` before editing
any component.
