# @svelte-motion/core

Remotion-style video primitives for Svelte 5. Frame is state.

## Install

```bash
bun add @svelte-motion/core
```

Requires Svelte 5 and SvelteKit 3. Peer dependency is `svelte ^5.0.0`.

## Frame model

A composition is a pure function of `frame`. `MotionRoot` owns a `MotionContext` with `frame` as `$state`. Every animated value derives from it with `$derived`. The renderer drives the frame by calling `window.svelteMotion_setFrame(n)` and awaiting the paint, then screenshots. The same component renders identically in the Studio preview, the Player, and the headless renderer because all three use the same context.

## Quickstart

Define a composition:

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

Use frame primitives inside the component:

```svelte
<script lang="ts">
  import { getMotionContext, interpolate, spring } from "@svelte-motion/core";

  let { title = "Hello" }: { title?: string } = $props();
  const ctx = getMotionContext();
  const frame = $derived(ctx.frame);
  const opacity = $derived(interpolate(frame, [0, 30], [0, 1]));
  const x = $derived(spring({ frame, fps: 30 }));
</script>

<div style:opacity={opacity} style:transform="translateX({x * 200}px)">
  {title}, frame {frame}
</div>
```

Mount it for rendering:

```svelte
<script lang="ts">
  import { MotionRoot } from "@svelte-motion/core";
  import HelloWorld from "./HelloWorld.svelte";
</script>

<MotionRoot fps={30} width={1920} height={1080} durationInFrames={90} initialFrame={0}>
  <HelloWorld title="Hello" />
</MotionRoot>
```

Register compositions in your app. The glob must live in the app, not in core, because `import.meta.glob` resolves relative to the file that contains it:

```ts
import { collectCompositions } from "@svelte-motion/core";
const compositions = collectCompositions(
  import.meta.glob("/src/compositions/*/index.ts", { eager: true }),
);
```

## Timeline

All timeline components narrow the frame their children see. Each one creates a `DerivedMotionContext` over its parent.

| Component      | Props                                                                                  | What it does                                                                                                                      |
| -------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `Sequence`     | `from?: number`, `durationInFrames?: number`, `children: Snippet<[{ frame: number }]>` | Shifts time by `from`. Children receive local frame as snippet argument and via context. Renders nothing when outside its window. |
| `Series`       | `children: Snippet` containing `Series.Sequence` items                                 | Lays out children sequentially, computing `from` cumulatively from each item's `durationInFrames`.                                |
| `Loop`         | `durationInFrames: number`, `times?: number`                                           | Wraps frame with modulo. `frame % durationInFrames`.                                                                              |
| `Freeze`       | `frame: number`                                                                        | Pins children to a single frame.                                                                                                  |
| `AbsoluteFill` | `style?: string`                                                                       | Fills the composition with absolute positioning.                                                                                  |
| `Clipper`      | `width?, height?, style?`                                                              | Clips overflowing children with `overflow: hidden`.                                                                               |
| `Stage`        | `width, height, background?`                                                           | Root stage with fixed size, `contain: strict`, and background color. Used internally by `MotionRoot` and `Player`.                |

Snippet usage:

```svelte
<Sequence from={30} durationInFrames={60}>
  {#snippet children({ frame })}
    <div>local frame {frame}</div>
  {/snippet}
</Sequence>
```

## Player

Browser playback at `fps` with seek and loop. Wall clock is used only for timing, never for rendering.

```svelte
<script lang="ts">
  import { Player } from "@svelte-motion/core";
  import MyComp from "./MyComp.svelte";
  let playerRef = $state(null);
</script>

<Player
  bind:this={playerRef}
  component={MyComp}
  inputProps={{ title: "Hi" }}
  fps={30}
  width={1920}
  height={1080}
  durationInFrames={90}
  startFrame={0}
  autoPlay={false}
  loop={true}
  controls={true}
/>

<button onclick={() => playerRef?.play()}>Play</button>
<button onclick={() => playerRef?.pause()}>Pause</button>
<button onclick={() => playerRef?.seek(30)}>Seek to 30</button>
```

Props (`PlayerProps` in `player/types.ts`):

| Prop                                   | Type               | Default                 | Notes                                       |
| -------------------------------------- | ------------------ | ----------------------- | ------------------------------------------- |
| `component`                            | `Component<Props>` | required                | Svelte component to render                  |
| `inputProps`                           | `Props`            | `{}`                    | Spread onto the component                   |
| `fps, width, height, durationInFrames` | `number`           | required                | Video config                                |
| `startFrame`                           | `number`           | `0`                     | Initial frame, clamped to `[0, duration-1]` |
| `autoPlay`                             | `boolean`          | `false`                 | Start playing on mount                      |
| `loop`                                 | `boolean`          | `true`                  | Wrap at end, otherwise stop on last frame   |
| `controls`                             | `boolean`          | `true`                  | Show built in play, pause, and scrubber     |
| `now`                                  | `() => number`     | `performance.now`       | Test seam for clock                         |
| `schedule`                             | `(cb) => number`   | `requestAnimationFrame` | Test seam for frame scheduling              |
| `cancel`                               | `(handle) => void` | `cancelAnimationFrame`  | Test seam for cancel                        |
| `onFrame`                              | `(frame) => void`  |                         | Called on every frame change                |

Exports `play()`, `pause()`, `seek(n)` on the component instance. Helpers `frameAt(elapsedMs, fps, durationInFrames, loop)` and `frameElapsedMs(frame, fps)` are also exported for custom players.

## Assets

```ts
import { staticFile, prefetch } from "@svelte-motion/core";
```

- `staticFile(path)` resolves a file in `static/` through the app base. Throws on absolute URLs. Example: `staticFile("images/logo.png")` returns `"/images/logo.png"` or `"/my-app/images/logo.png"` when a base is set.
- `prefetch(src)` injects a `<link rel="preload">` with `as` inferred from extension (image, video, audio, font, fetch). Returns a cleanup function. No-op when `document` is unavailable.

Media components handle `staticFile` and `delayRender` for you. All warnings use the `[svelte-motion]` prefix and are collected by the renderer.

| Component | Props                                           | Notes                                         |
| --------- | ----------------------------------------------- | --------------------------------------------- |
| `Img`     | `src, alt?, style?, ...`                        | Preloads image, blocks readiness until loaded |
| `Video`   | `src, startFrom?, muted?, volume?, style?, ...` | Syncs `currentTime` to frame                  |
| `Audio`   | `src, startFrom?, volume?, ...`                 | Audio element, not muxed into output in v1    |
| `IFrame`  | `src, style?, ...`                              | Iframe wrapper                                |

## Readiness

The renderer must not screenshot until fonts and assets are ready. A counter tracks open handles.

```ts
import {
  delayRender,
  continueRender,
  isReady,
  getPendingLabels,
  waitForReady,
} from "@svelte-motion/core";

const handle = delayRender("loading font");
// ... when done
continueRender(handle);
```

| Function                   | Purpose                                                                       |
| -------------------------- | ----------------------------------------------------------------------------- |
| `delayRender(label?)`      | Block rendering, returns a handle                                             |
| `continueRender(handle)`   | Release a handle, idempotent                                                  |
| `isReady()`                | True when no handles are open                                                 |
| `getPendingLabels()`       | Labels of open handles, for timeout messages                                  |
| `waitForReady()`           | Promise that resolves when all handles close                                  |
| `resetReadiness()`         | Test only, drops all handles                                                  |
| `installReadinessGlobal()` | Installs `window.svelteMotion_ready` and `window.svelteMotion_pendingHandles` |

Renderer handshake globals published by `MotionRoot` and the Studio hosts:

- `window.svelteMotion_ready() => boolean`
- `window.svelteMotion_pendingHandles() => string[]`
- `window.svelteMotion_setFrame(n) => Promise<void>` resolves after Svelte flush and paint
- `window.svelteMotion_getFrame() => number`
- `window.svelteMotion_getCompositions() => CompositionConfig[]`
- `window.svelteMotion_inputProps` current props for reproduction
- `window.svelteMotion_validationError` set when props fail schema validation

## Composition registry

```ts
import {
  defineComposition,
  getComposition,
  getCompositions,
  collectCompositions,
} from "@svelte-motion/core";
```

`defineComposition(config)` validates and registers one composition. Rules:

- `id` is required, kebab-case (`^[a-z0-9]+(?:-[a-z0-9]+)*$`), unique
- `width, height, fps, durationInFrames` must be positive integers
- `defaultProps` must be JSON serialisable, it travels through the URL as `?props=`
- `schema` is an optional Valibot schema. When both `schema` and `defaultProps` are present, `defaultProps` is validated at registration time. Props from `?props=` are validated at render time in the Studio hosts.

`collectCompositions(modules)` takes the result of an eager `import.meta.glob` and registers each default export. The glob must live in the app because Vite resolves it relative to the file that contains it.

## Math

Pure TypeScript, no Svelte or DOM. Ported from Remotion 4.0.538. Tests compare output against Remotion for the same inputs.

| Export                                                                                             | Purpose                                                                                                            |
| -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `interpolate(input, inputRange, outputRange, options?)`                                            | Range mapping with easing, extrapolate, and posterize                                                              |
| `prepareNumericInterpolation`                                                                      | Lower level numeric path used by `interpolate`                                                                     |
| `interpolateColors(input, inputRange, outputRange, options?)`                                      | Color interpolation, supports hex 3/4/6/8, rgb, rgba, hsl, hsla, and named colors                                  |
| `processColor(color)`                                                                              | Parse a color string to `0xrrggbbaa`                                                                               |
| `colorNames`                                                                                       | Map of CSS named colors                                                                                            |
| `spring({ frame, fps, config?, from?, to?, durationInFrames?, durationRestThreshold?, reverse? })` | Damped harmonic oscillator, advances one frame at a time                                                           |
| `springCalculation({ frame, fps, config? })`                                                       | Lower level spring node                                                                                            |
| `measureSpring({ fps, config?, threshold? })`                                                      | Frames until spring settles                                                                                        |
| `bezier(x1, y1, x2, y2)`                                                                           | Cubic bezier easing                                                                                                |
| `Easing`                                                                                           | Named curves: `linear, quad, cubic, poly, sin, circle, exp, elastic, back, bounce, bezier, spring, in, out, inOut` |

Not implemented: `output` and `outputType` CSS sugar for `interpolate`, and CSS Color 4 spaces (`oklch, oklab, lab, lch, hwb`) for `interpolateColors`. Passing them throws a clear error.

## Environment

```ts
import { getSvelteMotionEnvironment, setSvelteMotionEnvironmentFlag } from "@svelte-motion/core";
const env = getSvelteMotionEnvironment();
// { isStudio, isRendering, isPlayer }
```

Flags are set by the shell before the bundle evaluates: `svelteMotion_isStudio`, `svelteMotion_isRendering`, `svelteMotion_isPlayer`. The renderer sets `isRendering` before navigation.

## Limits

- `useCurrentFrame()` returns a snapshot number, not a reactive value. For reactivity use `$derived(getMotionContext().frame)`.
- Named component prop types live in `timeline/types.ts` and `player/types.ts`, not inside `.svelte` files, so `svelte-check` can see them.
- No React. Components use Svelte 5 runes (`$state, $derived, $effect, $props`) and snippets.
- Audio elements render but are not muxed into the MP4 in v1. The renderer encodes video only.
- Frames must be pure functions of `frame`. Do not use `Math.random` or `Date.now` in compositions.

## License

MIT
