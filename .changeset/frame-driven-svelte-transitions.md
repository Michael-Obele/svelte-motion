---
"@svelte-motion/core": minor
---

Drive Svelte's own transition factories from the frame. `use:frameTransition` takes a
`TransitionConfig` factory — `fly`, `fade`, `blur`, `scale`, `slide`, `draw`, or one of your
own — calls it once, and evaluates the returned `css(t, u)` / `tick(t, u)` at
`t = (frame - from) / durationInFrames`, writing the result as inline styles. The directive
itself cannot be used in a composition: it fires when an element enters or leaves the DOM and
runs on the Web Animations API clock, so seeking to frame 45 restarts the intro at `t = 0`
and screenshots the wrong position. The factories were always pure functions of progress —
only the driver was wrong.

`from` is in the local frame of the enclosing `Sequence`. Durations may stay in milliseconds
and are converted through the composition's `fps`, or given directly as `durationInFrames` /
`delayInFrames`. `direction: "out"` runs the same factory backwards. Before the window the
element holds the start value; after it, the applied properties are removed and the element
returns to its own CSS.

Also re-exports Svelte's easing curves as `svelteEasing` (they are pure `(t) => number` and
satisfy `interpolate`'s `easing` option), and adds a determinism guard: after every seek, any
animation still running on the browser clock is reported once per identity on the
`[svelte-motion]` channel that lands in `RenderResult.warnings`. A composition that animates
with CSS `@keyframes` or `transition:` now says so instead of quietly rendering different
bytes on every run.

New `svelte-transition` example composition. Verified in headless Chromium: no running
animations at any frame, and frame 7 reports the same computed opacity whether the renderer
reached it from 3, 84, or 0.
