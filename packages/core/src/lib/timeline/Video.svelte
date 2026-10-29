<script lang="ts">
  /**
   * Video that participates in the readiness handshake.
   *
   * Holds the renderer until `loadeddata` fires, and again after each
   * `seeked` (the renderer screenshots only when ready). Errors warn and
   * continue so a missing asset never hangs the render.
   *
   * Seek target is a pure function of frame: `currentTime = (frame + startFrom) / fps`.
   */
  import { onDestroy, untrack } from "svelte";
  import { getMotionContext } from "../motion/context.svelte.js";
  import { continueRender, delayRender } from "../motion/ready.js";
  import { staticFile } from "../motion/asset.js";
  import type { VideoProps } from "./media.js";

  let {
    src,
    startFrom = 0,
    muted = true,
    volume = 1,
    style = "",
    onloadeddata,
    onseeked,
    onerror,
    ...rest
  }: VideoProps = $props();

  const motion = getMotionContext();

  const resolvedSrc = $derived.by(() => {
    try {
      return staticFile(src);
    } catch {
      return src;
    }
  });

  let videoEl: HTMLVideoElement | undefined = $state(undefined);

  // Plain `let`, not `$state`: imperative bookkeeping for the non-reactive
  // handle set in `ready.ts`, never rendered. Marking these reactive made the
  // seek effect dirty itself, because it both reads and writes them.
  let initialHandle: number | null = null;
  let initialSettled = false;
  let seekHandle: number | null = null;
  let seekSettled = true;

  const settleInitial = () => {
    if (initialSettled) return;
    initialSettled = true;
    if (initialHandle !== null) continueRender(initialHandle);
  };

  const settleSeek = () => {
    if (seekSettled) return;
    seekSettled = true;
    if (seekHandle !== null) {
      continueRender(seekHandle);
      seekHandle = null;
    }
  };

  initialHandle = delayRender(`<Video src="${untrack(() => resolvedSrc)}">`);
  initialSettled = false;

  const onLoadedData = (event: Event) => {
    settleInitial();
    onloadeddata?.(event);
  };

  const onSeeked = (event: Event) => {
    settleSeek();
    onseeked?.(event);
  };

  const onError = (event: Event) => {
    console.warn(
      `[svelte-motion] video failed to load: ${untrack(() => resolvedSrc)}`,
    );
    settleInitial();
    settleSeek();
    onerror?.(event);
  };

  let lastSrc = untrack(() => resolvedSrc);
  $effect(() => {
    void resolvedSrc;
    const current = resolvedSrc;
    if (current === lastSrc) return;
    lastSrc = current;
    if (!initialSettled && initialHandle !== null)
      continueRender(initialHandle);
    initialHandle = delayRender(`<Video src="${current}">`);
    initialSettled = false;
    if (!seekSettled && seekHandle !== null) {
      continueRender(seekHandle);
      seekHandle = null;
      seekSettled = true;
    }
  });

  $effect(() => {
    const frame = motion.frame;
    const fps = motion.fps;
    const target = (frame + startFrom) / fps;
    if (!videoEl) return;
    if (videoEl.readyState >= 1) {
      if (seekHandle !== null && !seekSettled) {
        continueRender(seekHandle);
      }
      seekHandle = delayRender(
        `<Video src="${resolvedSrc}" seek frame=${frame}>`,
      );
      seekSettled = false;
      if (Math.abs(videoEl.currentTime - target) < 0.001) {
        settleSeek();
      } else {
        try {
          videoEl.currentTime = target;
        } catch {
          settleSeek();
        }
      }
    } else {
      try {
        videoEl.currentTime = target;
      } catch {}
    }
  });

  $effect(() => {
    if (videoEl) videoEl.volume = volume;
  });

  $effect(() => {
    if (videoEl) videoEl.muted = muted;
  });

  onDestroy(() => {
    settleInitial();
    settleSeek();
  });
</script>

<video
  bind:this={videoEl}
  src={resolvedSrc}
  {muted}
  preload="auto"
  playsinline
  {style}
  onloadeddata={onLoadedData}
  onseeked={onSeeked}
  onerror={onError}
  {...rest}
></video>
