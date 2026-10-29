---
name: svelte-motion
description: Write and render videos with svelte-motion — Svelte 5 components as frames, headless Chromium screenshots, FFmpeg encode. Use when the user asks to create a video, animation, motion graphic, title card, or lower third in a Svelte app, or mentions svelte-motion, defineComposition, Sequence, useCurrentFrame, interpolate, or spring.
---

# svelte-motion

Write a video the way you write a Svelte page. A frame is a function of time; the renderer screenshots every frame in headless Chromium and FFmpeg stitches them into an MP4.

## The one rule

**Frames must be pure functions of `frame`.** No `Date.now()`, no `Math.random()`, no wall clock, no un-awaited fetches. The determinism gate renders the same frame twice and compares bytes; anything nondeterministic fails it, and a video that renders differently each run cannot be cached or diffed.

## Setup

```bash
bunx sv create my-video && cd my-video
bun add @svelte-motion/core
```

Mount the player, or render headless with `@svelte-motion/cli`.

## A composition

A composition is a component plus a config object. `defineComposition` ties them together and the registry picks it up from a Vite glob.

```svelte
<!-- src/lib/compositions/title-card/TitleCard.svelte -->
<script lang="ts">
  import { getMotionContext, interpolate } from "@svelte-motion/core";

  let { title = "Hello" } = $props();

  // getContext() only works during component init, so grab the context once
  // and derive from its `frame`. Never call useCurrentFrame() inside $derived.
  const motion = getMotionContext();
  const frame = $derived(motion.frame);

  const opacity = $derived(
    interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" }),
  );
</script>

<div style="opacity: {opacity}; color: white; font: 96px system-ui">
  {title}
</div>
```

```ts
// src/lib/compositions/title-card/index.ts
import { defineComposition } from "@svelte-motion/core";
import * as v from "valibot";
import TitleCard from "./TitleCard.svelte";

export default defineComposition({
  id: "title-card",
  component: TitleCard,
  fps: 30,
  width: 1920,
  height: 1080,
  durationInFrames: 90,
  defaultProps: { title: "Hello" },
  schema: v.object({ title: v.string() }),
});
```

## Reading time

| Need                       | Use                                                                                |
| -------------------------- | ---------------------------------------------------------------------------------- |
| Current frame (reactive)   | `const motion = getMotionContext(); const frame = $derived(motion.frame);`         |
| One-off frame read         | `useCurrentFrame()` — **init only**, never in `$derived` or the template           |
| fps, size, total frames    | `const { fps, width, height, durationInFrames } = untrack(() => useVideoConfig())` |
| A component starting later | `<Sequence from={30} durationInFrames={60}>`                                       |
| Several in a row           | `<Series items={[...]}>`                                                           |
| Repeat                     | `<Loop durationInFrames={30}>`                                                     |
| Pin a frame                | `<Freeze frame={45}>`                                                              |
| Media with load tracking   | `<Img>`, `<Video>`, `<Audio>`, `<IFrame>`                                          |

`Sequence` children see a **local** frame: `from=30` and global frame 45 means the child reads 15. Nest them and the offsets add up. Give each Sequence an `id` if you want a stable label in the Studio timeline.

## Animating

`interpolate(value, inputRange, outputRange, options?)` maps a value across keyframes. Options: `easing`, `extrapolateLeft`/`extrapolateRight` (`"clamp"` is what you want 90% of the time), `posterize`. Outputs can be numbers, same-shape number tuples, or CSS strings with matching units.

`spring({ frame, fps, config })` gives physics-based motion. `measureSpring()` tells you how long it takes.

`interpolateColors()` blends colours. Easing functions live under `Easing`, and Svelte's own curves are re-exported as `svelteEasing` (`{ easing: svelteEasing.bounceOut }`).

### Svelte transitions

`transition:fly` cannot be used in a composition: it fires when an element enters or leaves the DOM and runs on the Web Animations API clock, so seeking to frame 45 restarts the intro at `t = 0`. The factory behind it (`fly(node, params)` → `css(t, u)`) is pure, so drive that instead:

```svelte
<script>
  import { fly } from "svelte/transition";
  import { frameTransition, Sequence } from "@svelte-motion/core";

  const intro = { fn: fly, params: { y: 200 }, from: 0, durationInFrames: 15 };
</script>

<Sequence from={30} durationInFrames={45}>
  <div use:frameTransition={intro}>flies in over frames 30-45, then holds</div>
</Sequence>
```

`from` and `durationInFrames` are in the local frame of the enclosing `Sequence`. `direction: "out"` runs the same factory backwards. Before the window the element holds the start value; after it, the applied styles are removed and the element returns to its own CSS. Hoist the options object out of the template — a fresh literal on each render re-runs the factory, and `slide`/`scale`/`draw` measure the node while doing so.

**Not implemented:** the `output` / `outputType` options (`"perceptual-scale"`, `"font-weight"`) throw rather than silently doing the wrong thing.

## Rendering

```bash
svelte-motion                                                  # interactive: browse, render, watch progress
svelte-motion list --build build
svelte-motion render title-card --out out/title-card.mp4 --build build
svelte-motion render title-card --out out.mp4 --props '{"title":"Hi"}' --crf 20 --concurrency 2
```

FFmpeg must be on `PATH`. The CLI checks and tells you how to install it.

Rendering is Node-only: `@svelte-motion/renderer` shells out to Playwright and FFmpeg, so it must never end up in a browser bundle. Keep compositions in `@svelte-motion/core`.

## Gotchas

- **Async work needs `delayRender`.** Fonts, images and `fetch` must be awaited through `delayRender()` / `continueRender(handle)`, or the screenshot fires before they land and you get a blank frame. `await document.fonts.ready` alone is not enough for a `staticFile` image.
- **`staticFile(path)`** resolves to the app's `static/` folder. A missing path warns with the frame number instead of silently rendering blank.
- **Named types cannot be exported from `.svelte` files.** Put prop types in a `.ts` module (`timeline/types.ts` pattern) or `svelte-check` will not see them.
- **Concurrency 1 streams** (flat memory). Higher values buffer every frame to reorder them, so memory scales with video length — use it only when render time matters more.
- **Wall clock is fine in the Player, never in a composition.** The Player drives frames from real time; a composition must not.
- **A running CSS or WAAPI animation is reported, not fixed.** After each seek, any animation still on the browser clock warns once per identity (`[svelte-motion] animation "spin" was still running at frame N`) and lands in `RenderResult.warnings`. The render still succeeds — with different bytes each run.

## Where things live

- Frame runtime: `packages/core/src/lib/motion/context.svelte.ts`
- Svelte transition integration: `packages/core/src/lib/motion/frame-transition.svelte.ts`
- Timeline primitives: `packages/core/src/lib/timeline/`
- Math: `packages/core/src/lib/math/`
- Render loop: `packages/renderer/src/render.ts`
- Studio chrome: `packages/studio-ui/src/lib/Studio.svelte`
