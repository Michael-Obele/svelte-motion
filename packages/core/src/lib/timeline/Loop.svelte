<script lang="ts">
  /**
   * Repeats its children.
   *
   * Local frame wraps inside the content duration, so whatever the children draw
   * restarts every `durationInFrames`. Omit `times` to loop for the rest of the
   * composition.
   */
  import type { Snippet } from "svelte";
  import {
    DerivedMotionContext,
    getMotionContext,
    setMotionContext,
  } from "../motion/context.svelte.js";

  let {
    from = 0,
    durationInFrames,
    times,
    children,
  }: {
    from?: number;
    durationInFrames: number;
    times?: number;
    children: Snippet<[{ frame: number }]>;
  } = $props();

  if (!Number.isInteger(durationInFrames) || durationInFrames <= 0) {
    throw new Error(
      `<Loop> needs a positive integer durationInFrames, but got ${durationInFrames}`,
    );
  }

  const wrap = (value: number): number =>
    ((value % durationInFrames) + durationInFrames) % durationInFrames;

  const parent = getMotionContext();
  setMotionContext(new DerivedMotionContext(parent, (p) => wrap(p.frame - from)));

  const outerFrame = $derived(parent.frame - from);
  const localFrame = $derived(wrap(outerFrame));
  const visible = $derived(
    outerFrame >= 0 &&
      (times === undefined || outerFrame < durationInFrames * times),
  );
</script>

{#if visible}
  {@render children({ frame: localFrame })}
{/if}
