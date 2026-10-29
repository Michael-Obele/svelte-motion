# 0005. Svelte's built-in motion is an interaction primitive, not a render primitive

**Status:** Accepted, 2026-10-29. Implemented.

## Context

Svelte ships motion: `svelte/transition` (`fade`, `fly`, `blur`, `scale`, `slide`,
`draw`, `crossfade`), `svelte/animate` (`flip`), `svelte/easing` (27 curves), and
`svelte/motion` (`Spring`, `Tween`, `prefersReducedMotion`). Asking why the product
drives animation from `frame` — Remotion's model — instead of using what the
framework already does is a fair question, and the answer is not uniform across
those four modules.

Three properties make a frame renderable at all (see ADR 0003 and the M0 gate):

- **Seekable.** Frame 45 must look the same whether the renderer reached it from 44
  or from 120.
- **Pure.** The frame is the only input. No wall clock.
- **Mount-independent.** The renderer re-renders on every seek, so an element can be
  created at any point in the sequence.

Svelte's built-ins fail the third property by construction. `transition:` fires when
an element enters or leaves the DOM, and per the Svelte docs the animation is driven
by the **Web Animations API**, not CSS. Under frame stepping the element mounts at
the instant we seek to its frame, so its intro begins at `t = 0` and the screenshot
captures the start of a transition that should have been half over. `Spring` and
`Tween` advance on `performance.now()`, which is exactly the wall clock the
determinism gate forbids. An outro cannot be pinned to a frame either: a block
transitioning out keeps its elements in the DOM until every transition completes.

`Sequence` already owns the clock that none of them have — `localFrame = parent.frame

- offset` — and that is the primitive a video needs.

## Decision

Keep the frame runtime as the driver, and integrate with Svelte's motion at the two
places where it is genuinely compatible:

1. **Reuse `svelte/easing` as-is.** The curves are pure `(t: number) => number`
   functions with no clock and no DOM, so they satisfy `interpolate`'s `easing`
   option directly. Core re-exports them as `svelteEasing` rather than copying them.
2. **Keep the transition _factories_, replace their _driver_.** A built-in is a
   function returning a `TransitionConfig` whose `css(t, u)` / `tick(t, u)` are pure
   functions of progress. Only the clock around them is wrong. `use:frameTransition`
   is an action that calls the factory once, then evaluates it at
   `t = (frame - from) / durationInFrames` and writes the result to the node's
   inline styles. It never calls `animate()`.
3. **Report what cannot be integrated.** After every seek, `MotionRoot` lists the
   animations still running on the browser clock and warns once per identity, on the
   existing `[svelte-motion]` channel the renderer collects into
   `RenderResult.warnings`.

`interpolate`, `spring`, `measureSpring`, `bezier`, `Sequence`/`Series`/`Loop`/`Freeze`
and `delayRender` stay as they are. They are the frame runtime, not an imitation of
Remotion's UI.

## Consequences

**What got harder.** `frameTransition` is an action, not a directive, so it does not
come free from Svelte's template syntax and it has to be explained. Factories that
measure the node (`slide`, `scale`, `draw`) take that measurement once and treat it
as constant for the life of the transition; re-resolving clears our own applied
properties first so a measured `transform` cannot feed back into the next frame.
`crossfade` (deferred, multi-node) and `animate:flip` (driven by real layout
movement) are out of scope.

**What got better.** Authors can keep the transitions they already know. The
built-ins become seekable in both directions, which the directive can never be. Six
easing curves do not need a clean-room implementation under D22 — they are
re-exported from Svelte under its own licence, with no derivation to audit. And a
silent non-determinism bug now produces a warning naming the animation.

**What did not change.** The renderer still drives frames through
`window.svelteMotion_setFrame` and still awaits the flush and the paint before
screenshotting. No CDP virtual time, no `Animation.setPlaybackRate`: those would
work, but they contradict the paint-await contract in `browser.ts` and would mean
re-verifying the M0 and M2 gates from scratch.

Rejected alternatives:

- **Render with CSS virtual time** (`Emulation.setVirtualTimePolicy`, or the
  `animation-play-state: paused; animation-delay: -t` trick). Deterministic and real,
  and left open as a future render mode — but it makes the renderer's correctness
  depend on the browser's clock emulation.
- **Adopt `Spring`/`Tween` as the animation model.** Trades a seekable clock for a
  wall clock and breaks every gate.
- **Do nothing and document GSAP plus plain CSS** (the R4 answer in
  `plan/decisions.md`). Leaves the frame runtime the only way to animate, when the
  factories were already pure.

See decision D28 in `plan/decisions.md`.
