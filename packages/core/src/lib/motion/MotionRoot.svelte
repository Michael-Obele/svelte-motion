<script lang="ts">
  /**
   * Owns the root motion context and publishes the globals the renderer drives.
   *
   * The renderer calls `window.svelteMotion_setFrame(n)` and awaits it. The await
   * matters: it resolves only after Svelte has flushed the new frame and the
   * browser has produced a paint, so a screenshot taken right after cannot catch
   * the previous frame.
   */
  import { onMount, tick, type Snippet } from "svelte";
  import { MotionContext } from "./context.svelte.js";
  import { setMotionContext, type VideoConfig } from "./context.svelte.js";
  import { installReadinessGlobal } from "./ready.js";

  let {
    fps,
    width,
    height,
    durationInFrames,
    frame = 0,
    background = "#000",
    children,
  }: {
    children: Snippet;
  } & VideoConfig & { frame?: number; background?: string } = $props();

  const motion = new MotionContext({ fps, width, height, durationInFrames });
  setMotionContext(motion);

  motion.frame = frame;

  const nextPaint = (): Promise<void> =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

  onMount(() => {
    installReadinessGlobal();

    const bridge = window as unknown as Record<string, unknown>;
    bridge.svelteMotion_setFrame = async (next: number): Promise<void> => {
      motion.frame = next;
      await tick();
      await nextPaint();
    };
    bridge.svelteMotion_getFrame = (): number => motion.frame;
    bridge.svelteMotion_isPlayer = false;

    return () => {
      delete bridge.svelteMotion_setFrame;
      delete bridge.svelteMotion_getFrame;
    };
  });
</script>

<div
  class="svelte-motion-root"
  style:width="{width}px"
  style:height="{height}px"
  style:background
>
  {@render children()}
</div>

<style>
  .svelte-motion-root {
    position: relative;
    overflow: hidden;
    /* A composition is a picture, not a page: no scroll anchoring, no text
       reflow surprises between frames. */
    contain: strict;
  }
</style>
