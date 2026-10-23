<script lang="ts">
  /**
   * Pins its children to one frame.
   *
   * Useful for a title card or a still inside a moving composition: the children
   * never advance, however the surrounding timeline moves.
   */
  import type { Snippet } from "svelte";
  import {
    DerivedMotionContext,
    getMotionContext,
    setMotionContext,
  } from "../motion/context.svelte.js";

  let { frame: pinned = 0, children }: { frame?: number; children: Snippet } = $props();

  const parent = getMotionContext();
  setMotionContext(new DerivedMotionContext(parent, () => pinned));
</script>

{@render children()}
