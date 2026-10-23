<script lang="ts">
  /**
   * The M0 composition.
   *
   * Everything it draws is a pure function of `frame`: no `Math.random`, no
   * `Date.now`, no CSS animations or transitions. A wall-clock source here would
   * still look correct on screen and would silently break the renderer, which
   * screenshots frames one at a time — that is exactly what the determinism
   * spike exists to catch.
   */
  import { untrack } from "svelte";
  import { AbsoluteFill, getMotionContext, interpolate, spring } from "@svelte-motion/core";

  let { title = "Hello Svelte Motion" }: { title?: string } = $props();

  // `getContext` only resolves during component init, so read the context once and
  // derive the reactive frame from it. `fps` never changes, hence `untrack`.
  const motion = getMotionContext();
  const frame = $derived(motion.frame);
  const fps = untrack(() => motion.fps);

  // Fades a box in over the first second.
  const boxOpacity = $derived(
    interpolate(frame, [0, 30], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );

  // Critically damped spring: the title rises into place without overshooting.
  const entry = $derived(spring({ frame, fps, config: { damping: 200 } }));

  const titleOffset = $derived(
    interpolate(entry, [0, 1], [60, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
</script>

<AbsoluteFill style="background: #0b1020; align-items: center; justify-content: center; gap: 56px;">
  <div class="box" style="opacity: {boxOpacity};"></div>
  <h1 class="title" style="opacity: {entry}; transform: translateY({titleOffset}px);">
    {title}
  </h1>
</AbsoluteFill>

<style>
  .box {
    width: 320px;
    height: 320px;
    border-radius: 64px;
    background: #6366f1;
  }

  .title {
    margin: 0;
    color: #f8fafc;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 96px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
</style>
