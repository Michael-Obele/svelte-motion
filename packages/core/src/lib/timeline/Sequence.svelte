<script lang="ts">
  /**
   * Offsets time for its children.
   *
   * Children see a local frame through both channels: the `frame` snippet
   * argument and `useCurrentFrame()` inside the nearest context. The snippet
   * argument is the explicit one; the context override means nested components
   * do not need the frame threaded through them.
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
    children,
  }: {
    from?: number;
    durationInFrames?: number;
    children: Snippet<[{ frame: number }]>;
  } = $props();

  const parent = getMotionContext();
  setMotionContext(new DerivedMotionContext(parent, (p) => p.frame - from));

  const localFrame = $derived(parent.frame - from);
  const visible = $derived(
    localFrame >= 0 && (durationInFrames === undefined || localFrame < durationInFrames),
  );
</script>

{#if visible}
  {@render children({ frame: localFrame })}
{/if}
