# Examples

Four compositions that show what the engine can do. They are not a separate app: the
studio owns the render host, so each example is a folder with a Svelte component and an
`index.ts` that calls `defineComposition`. The studio, the CLI, and the e2e suite all read
them from here.

| Id              | Frames | What it shows                                                                                                |
| --------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| `title-card`    | 90     | Spring entrance, a rule that draws with `interpolate`, staged timing with `Sequence`, and a timed exit       |
| `lower-third`   | 120    | A graphic sliding in and out inside one `Sequence`, with the exit computed from the local frame              |
| `image-gallery` | 120    | Three images cross-fading, slow scale on each, `prefetch` before the first frame                             |
| `data-chart`    | 150    | Bars from a JSON file fetched under `delayRender`, staggered springs, counted labels, a valibot props schema |

Static files used by the examples live in `apps/studio/static/examples/`.

## See them

```bash
vp run studio#dev
```

Open the studio and pick a composition. The player, scrubber, and timeline work on every
example.

## Render them

```bash
vp run studio#build
bun packages/cli/src/index.ts render title-card --out out/title-card.mp4 --build apps/studio/build
```

Swap the id for `lower-third`, `image-gallery`, or `data-chart`.

## Props

`title-card`, `lower-third`, and `data-chart` take props. Pass them through the CLI as
JSON:

```bash
bun packages/cli/src/index.ts render title-card --out out/card.mp4 \
  --props '{"title":"Release 0.1","subtitle":"Changelog"}' \
  --build apps/studio/build
```

`data-chart` declares a valibot schema, so a bad value is rejected with the issue path
instead of rendering a broken frame. Try `--props '{"heading":""}'`.

## Rules for new examples

- A frame is a pure function of its number. No `Math.random`, no `Date.now`, no CSS
  animations or transitions.
- Assets go in `apps/studio/static/examples/` and are referenced through `staticFile`.
- Async work (fetch, media) is wrapped in `delayRender` / `continueRender`, so the
  renderer waits for it before the first screenshot.
