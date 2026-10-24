<script lang="ts">
  /**
   * Example: title card.
   *
   * A staged entrance (title rises, rule draws, subtitle follows) and a timed
   * exit. Every value is a pure function of `frame`, so the renderer can
   * screenshot any frame in any order and get the same picture.
   */
  import { untrack } from "svelte";
  import {
    AbsoluteFill,
    Sequence,
    getMotionContext,
    interpolate,
    spring,
  } from "@svelte-motion/core";
  import type { TitleCardProps } from "./props.js";

  let {
    title = "Svelte Motion",
    subtitle = "Videos as components",
  }: TitleCardProps = $props();

  const motion = getMotionContext();
  const frame = $derived(motion.frame);
  const fps = untrack(() => motion.fps);

  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;

  // Title: critically damped rise, no overshoot.
  const titleEntry = $derived(spring({ frame, fps, config: { damping: 200 } }));
  const titleOffset = $derived(
    interpolate(titleEntry, [0, 1], [48, 0], clamp),
  );

  // Rule: draws from the centre, starting a beat after the title.
  const ruleScale = $derived(
    interpolate(frame, [14, 40], [0, 1], clamp),
  );

  // Exit: the whole card fades over the final 18 frames.
  const cardOpacity = $derived(interpolate(frame, [72, 90], [1, 0], clamp));
</script>

<AbsoluteFill
  style="background: #0b1020; align-items: center; justify-content: center;"
>
  <div class="card" style="opacity: {cardOpacity};">
    <h1
      class="title"
      style="opacity: {titleEntry}; transform: translateY({titleOffset}px);"
    >
      {title}
    </h1>

    <div class="rule" style="transform: scaleX({ruleScale});"></div>

    <Sequence from={24} durationInFrames={66}>
      {#snippet children({ frame: local })}
        {@const entry = spring({
          frame: local,
          fps,
          config: { damping: 200 },
        })}
        <p class="subtitle" style="opacity: {entry};">
          {subtitle}
        </p>
      {/snippet}
    </Sequence>
  </div>
</AbsoluteFill>

<style>
  .card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 32px;
  }

  .title {
    margin: 0;
    color: #f8fafc;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 112px;
    font-weight: 700;
    letter-spacing: -0.03em;
    line-height: 1;
  }

  .rule {
    width: 96px;
    height: 3px;
    background: #6366f1;
    transform-origin: center;
  }

  .subtitle {
    margin: 0;
    color: #94a3b8;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    font-size: 34px;
    font-weight: 400;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }
</style>
