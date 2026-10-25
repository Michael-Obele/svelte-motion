<script lang="ts">
  /**
   * Audio that participates in the readiness handshake.
   *
   * Hidden `<audio>` element; same seek policy as `Video`.
   * M3 does not mux audio into the MP4 (video-only v1) — this component
   * exists for preview parity.
   */
  import { onDestroy, untrack } from "svelte";
  import { getMotionContext } from "../motion/context.svelte.js";
  import { continueRender, delayRender } from "../motion/ready.js";
  import { staticFile } from "../motion/asset.js";
  import type { AudioProps } from "./media.js";

  let { src, startFrom = 0, volume = 1, ...rest }: AudioProps = $props();

  const motion = getMotionContext();

  const resolvedSrc = $derived.by(() => {
    try {
      return staticFile(src);
    } catch {
      return src;
    }
  });

  let audioEl: HTMLAudioElement | undefined = $state(undefined);

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

  initialHandle = delayRender(`<Audio src="${untrack(() => resolvedSrc)}">`);
  initialSettled = false;

  const onLoadedData = () => {
    settleInitial();
  };

  const onSeeked = () => {
    settleSeek();
  };

  const onError = () => {
    console.warn(`[svelte-motion] audio failed to load: ${untrack(() => resolvedSrc)}`);
    settleInitial();
    settleSeek();
  };

  let lastSrc = untrack(() => resolvedSrc);
  $effect(() => {
    void resolvedSrc;
    const current = resolvedSrc;
    if (current === lastSrc) return;
    lastSrc = current;
    if (!initialSettled && initialHandle !== null) continueRender(initialHandle);
    initialHandle = delayRender(`<Audio src="${current}">`);
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
    if (!audioEl) return;
    if (audioEl.readyState >= 1) {
      if (seekHandle !== null && !seekSettled) {
        continueRender(seekHandle);
      }
      seekHandle = delayRender(`<Audio src="${resolvedSrc}" seek frame=${frame}>`);
      seekSettled = false;
      if (Math.abs(audioEl.currentTime - target) < 0.001) {
        settleSeek();
      } else {
        try {
          audioEl.currentTime = target;
        } catch {
          settleSeek();
        }
      }
    } else {
      try {
        audioEl.currentTime = target;
      } catch {}
    }
  });

  $effect(() => {
    if (audioEl) audioEl.volume = volume;
  });

  onDestroy(() => {
    settleInitial();
    settleSeek();
  });
</script>

<audio
  bind:this={audioEl}
  src={resolvedSrc}
  preload="auto"
  onloadeddata={onLoadedData}
  onseeked={onSeeked}
  onerror={onError}
  {...rest}
></audio>
