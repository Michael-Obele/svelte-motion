<script lang="ts">
  /**
   * Browser Player: frame-accurate rAF playback with seek and loop.
   *
   * Wall clock is allowed here (playback timing) — never for rendering.
   * `frameAt` is pure and deterministic; the rAF loop just drives it.
   *
   * Test seams `now`/`schedule`/`cancel` let jsdom tests drive time
   * deterministically without fake timers.
   */
  import { onMount, untrack } from "svelte";
  import {
    MotionContext,
    setMotionContext,
    type SequenceEntry,
  } from "../motion/context.svelte.js";
  import Stage from "../motion/Stage.svelte";
  import PlayerControls from "./PlayerControls.svelte";
  import { frameAt, frameElapsedMs } from "./frame-time.js";
  import type { PlayerProps } from "./types.js";

  let {
    component,
    inputProps = {},
    fps,
    width,
    height,
    durationInFrames,
    startFrame = 0,
    autoPlay = false,
    loop = true,
    controls = true,
    isPlaying = $bindable(false),
    now = () => (typeof performance !== "undefined" ? performance.now() : 0),
    schedule = (cb: FrameRequestCallback): number =>
      typeof requestAnimationFrame !== "undefined"
        ? requestAnimationFrame(cb)
        : (setTimeout(
            () =>
              cb(typeof performance !== "undefined" ? performance.now() : 0),
            16,
          ) as unknown as number),
    cancel = (handle: number): void => {
      if (typeof cancelAnimationFrame !== "undefined") {
        cancelAnimationFrame(handle);
      } else {
        clearTimeout(handle);
      }
    },
    onFrame,
  }: PlayerProps = $props();

  const clamp = (n: number): number => {
    if (!Number.isFinite(n)) return 0;
    const max = Math.max(0, durationInFrames - 1);
    return Math.max(0, Math.min(n, max));
  };

  const context = untrack(
    () => new MotionContext({ fps, width, height, durationInFrames }),
  );
  setMotionContext(context);
  context.frame = untrack(() => clamp(startFrame));

  const frame = $derived(context.frame);

  let origin = 0;
  let handle: number | null = null;

  const tickAndSchedule = (): void => {
    handle = null;
    const elapsed = now() - origin;
    const next = frameAt(elapsed, fps, durationInFrames, loop);
    context.frame = next;
    onFrame?.(next);

    if (!loop) {
      const raw = Math.floor((elapsed * fps) / 1000);
      if (raw >= durationInFrames - 1) {
        isPlaying = false;
        return;
      }
    }

    if (isPlaying) {
      handle = schedule(tickAndSchedule);
    }
  };

  export function play(): void {
    if (isPlaying) return;
    isPlaying = true;
    origin = now() - frameElapsedMs(context.frame, fps);
    handle = schedule(tickAndSchedule);
  }

  export function pause(): void {
    if (!isPlaying) return;
    isPlaying = false;
    if (handle !== null) {
      cancel(handle);
      handle = null;
    }
  }

  export function seek(n: number): void {
    const clamped = clamp(n);
    context.frame = clamped;
    onFrame?.(clamped);
    origin = now() - frameElapsedMs(clamped, fps);
  }

  /** Live timeline registry for the Studio. Reactive when read inside `$derived`. */
  export function getSequences(): SequenceEntry[] {
    return context.getSequences();
  }

  onMount(() => {
    if (autoPlay) {
      play();
    }

    return () => {
      if (handle !== null) {
        cancel(handle);
        handle = null;
      }
      isPlaying = false;
    };
  });
</script>

<div class="svelte-motion-player">
  <Stage {width} {height}>
    {@const Component = component}
    <Component {...inputProps} />
  </Stage>

  {#if controls}
    <PlayerControls
      {frame}
      {durationInFrames}
      {fps}
      {isPlaying}
      onplay={play}
      onpause={pause}
      onseek={seek}
    />
  {/if}
</div>

<style>
  .svelte-motion-player {
    display: inline-block;
  }
</style>
