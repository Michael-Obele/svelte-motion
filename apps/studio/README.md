# Studio

The studio's own SvelteKit app: a hermetic render host for the gate compositions, and a
place to author the fixtures those gates depend on.

## What it is

- Authoring Studio at `/`, mounting `<Studio>` from `@svelte-motion/studio-ui` over this
  app's own compositions.
- Render host at `/render` that draws one frame of one composition with no chrome, driven by the renderer through query params.
- Player host at `/player` that draws one paused frame through `<Player>` for parity checks.
- Composition detail at `/compositions/[id]` with a JSON props editor.

The UI itself — picker, preview, transport, scrubber, timeline, and both pixel hosts — lives
in [`packages/studio-ui`](../../packages/studio-ui). This app owns only what an app must own:
routes, the composition glob, and URL state.

**Only fixtures live here**, never examples. `hello-world` is what the determinism and
parity gates render, and `fixture-*` cover missing assets, a stuck `delayRender`, and a
font-heavy load. Keeping them separate is deliberate: editing an example must not be able to
change what a gate measures.

To browse the real compositions, use the examples app instead:

```bash
bun run dev        # the examples app: gallery + Studio, all 8 compositions
bun run dev:studio # this app, for gate work
```

## Run

```bash
vp run studio#dev
# SvelteKit dev server, default http://localhost:5173
vp run studio#build
# Static build to apps/studio/build, served by the renderer with adapter-static fallback index.html
```

The renderer serves the built output, not the dev server, so HMR does not affect screenshots.

## Routes

| Route                | Purpose                                           | Query params                                                                                          |
| -------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `/`                  | Studio index: picker, preview, scrubber, timeline | `?composition=<id>` selects the active composition                                                    |
| `/render`            | Render host: one frame, no chrome                 | `?composition=<id>` required, `?frame=<n>` integer default 0, `?props=<json>` URL encoded JSON object |
| `/player`            | Player host: one paused frame through `<Player>`  | Same as `/render`: `?composition=<id>`, `?frame=<n>`, `?props=<json>`                                 |
| `/compositions/[id]` | Detail page with Player and JSON props editor     | Path param `id`, props edited in a textarea and applied with validation                               |

All routes are client only (`ssr = false`, `prerender = false`). Unknown composition ids render an error page that lists available ids. Invalid props show a validation error and fall back to `defaultProps`.

## Compositions

Each composition is a folder under `src/compositions/` with an `index.ts` that default exports `defineComposition`:

```ts
// src/compositions/hello-world/index.ts
import { defineComposition } from "@svelte-motion/core";
import HelloWorld from "./HelloWorld.svelte";

export default defineComposition({
  id: "hello-world",
  component: HelloWorld,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 90,
  defaultProps: { title: "Hello Svelte Motion" },
});
```

The app discovers them with an eager glob:

```ts
import { collectCompositions } from "@svelte-motion/core";
const compositions = collectCompositions(
  import.meta.glob("/src/compositions/*/index.ts", { eager: true }),
);
```

### Fixtures

| Id                      | Duration            | What it proves                                                             |
| ----------------------- | ------------------- | -------------------------------------------------------------------------- |
| `hello-world`           | 90 frames at 30 fps | Basic render, the M2 gate composition                                      |
| `fixture-font-heavy`    | 60 frames at 30 fps | Font loading with `delayRender` and Valibot schema validation, the M3 gate |
| `fixture-stuck`         | 30 frames at 30 fps | Never calls `continueRender`, used to test timeout errors                  |
| `fixture-missing-asset` | 30 frames at 30 fps | References a missing static asset, used to test warning collection         |

## Styling

Tailwind CSS v4 with `@tailwindcss/vite`. Only the apps use Tailwind. `@svelte-motion/core` stays framework free and has no Tailwind dependency. The Studio chrome uses Tailwind classes, but the pixel surfaces at `/render` and `/player` have minimal styling so determinism is not affected by utility changes.

## Pixel gate warning

Do not restyle `/render` or `/player`. Those routes are the surfaces the renderer screenshots. Any style change there changes pixels and will be caught by the determinism gate (`tools/spike/verify-determinism.ts`) and the player parity gate (`tools/spike/verify-player-parity.ts`). Studio chrome at `/` and `/compositions/[id]` is safe to style.

## Build

```bash
vp run studio#build
# output in apps/studio/build, includes index.html fallback for SPA routing
```

Uses `@sveltejs/adapter-static` with `fallback: "index.html"` so every path serves the same shell and client routing handles `/render?composition=...`.

## License

MIT
