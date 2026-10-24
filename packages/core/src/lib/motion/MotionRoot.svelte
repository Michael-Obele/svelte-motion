<script lang="ts">
  /**
   * Owns the root motion context and publishes the globals the renderer drives.
   *
   * The renderer calls `window.svelteMotion_setFrame(n)` and awaits it. The await
   * matters: it resolves only after Svelte has flushed the new frame and the
   * browser has produced a paint, so a screenshot taken right after cannot catch
   * the previous frame.
   *
   * Every prop is **init-only**. `fps`, `width`, `height` and
   * `durationInFrames` describe the video; `initialFrame` is the frame the
   * composition starts on. Changing any of them after mount does nothing — the
   * renderer drives the frame through `window.svelteMotion_setFrame`, and the
   * Player (M4) will drive it with a seek. The reads below are wrapped in
   * `untrack` to make that intent explicit (and to silence
   * `state_referenced_locally`), so nobody reads them as reactive.
   */
  import { onMount, tick, untrack, type Snippet } from "svelte";
  import { MotionContext } from "./context.svelte.js";
  import { setMotionContext, type VideoConfig } from "./context.svelte.js";
  import { installReadinessGlobal } from "./ready.js";

  let {
    fps,
    width,
    height,
    durationInFrames,
    initialFrame = 0,
    background = "#000",
    children,
  }: {
    children: Snippet;
  } & VideoConfig & { initialFrame?: number; background?: string } = $props();

  const motion = untrack(() => new MotionContext({ fps, width, height, durationInFrames }));
  setMotionContext(motion);

  motion.frame = untrack(() => initialFrame);

  const nextPaint = (): Promise<void> =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

  onMount(() => {
    installReadinessGlobal();

    // `svelteMotion_isPlayer` is owned by the shell that embeds us: the player
    // sets it through `setSvelteMotionEnvironmentFlag` before the bundle
    // evaluates. Writing it here would clobber that flag on every mount.
    const bridge = window as unknown as Record<string, unknown>;
    bridge.svelteMotion_setFrame = async (next: number): Promise<void> => {
      motion.frame = next;
      await tick();
      await nextPaint();
    };
    bridge.svelteMotion_getFrame = (): number => motion.frame;

    return () => {
      delete bridge.svelteMotion_setFrame;
      delete bridge.svelteMotion_getFrame;
      delete bridge.svelteMotion_ready;
      delete bridge.svelteMotion_pendingHandles;
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
