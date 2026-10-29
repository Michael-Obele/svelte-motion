<script lang="ts">
  /**
   * Example: Svelte's own transitions, driven by the frame.
   *
   * `fly` and `fade` are imported from `svelte/transition` — the factories, not
   * the directive. `use:frameTransition` calls them once and evaluates the
   * returned `css(t, u)` at the current frame, so the renderer can seek to any
   * point of the intro and get the same pixels. Durations stay in milliseconds
   * and are converted through the composition's `fps`.
   *
   * The bar is the other half of the integration: Svelte's `bounceOut` curve,
   * re-exported as `svelteEasing`, passed straight to `interpolate`.
   */
  import { fade, fly } from "svelte/transition";
  import {
    AbsoluteFill,
    frameTransition,
    getMotionContext,
    interpolate,
    svelteEasing,
    type FrameTransitionOptions,
  } from "@svelte-motion/core";

  let {
    headline = "Built in Svelte",
    caption = "svelte/transition, driven by the frame",
  }: { headline?: string; caption?: string } = $props();

  const motion = getMotionContext();
  const frame = $derived(motion.frame);

  // Hoisted: a fresh object literal per render would re-run the factory, and
  // `fly` reads the node's computed transform while doing so.
  const entry: FrameTransitionOptions = {
    fn: fly,
    params: { y: 140, x: -60, duration: 500 },
    from: 0,
  };

  const exit: FrameTransitionOptions = {
    fn: fade,
    params: { duration: 400 },
    from: 72,
    direction: "out",
  };

  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;

  const barWidth = $derived(
    interpolate(frame, [20, 60], [0, 100], {
      easing: svelteEasing.bounceOut,
      ...clamp,
    }),
  );
</script>

<AbsoluteFill style="background: #0b1020; align-items: center; justify-content: center;">
  <div class="stack">
    <h1 class="headline" use:frameTransition={entry}>{headline}</h1>

    <div class="track">
      <div class="fill" style="width: {barWidth}%;"></div>
    </div>

    <p class="caption" use:frameTransition={exit}>{caption}</p>
  </div>
</AbsoluteFill>

<style>
  .stack {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 56px;
  }

  .headline {
    margin: 0;
    font:
      900 128px system-ui,
      sans-serif;
    color: #f2f5fb;
    letter-spacing: -0.02em;
  }

  .track {
    width: 900px;
    height: 18px;
    border-radius: 999px;
    background: #1d2740;
    overflow: hidden;
  }

  .fill {
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #ff3e00, #ffb47a);
  }

  .caption {
    margin: 0;
    font:
      500 40px system-ui,
      sans-serif;
    color: #8ea0c8;
  }
</style>
