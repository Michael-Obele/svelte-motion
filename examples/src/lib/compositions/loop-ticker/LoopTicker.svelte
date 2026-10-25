<script lang="ts">
  /**
   * Example: ticker, driven by `Loop` (Tailwind).
   *
   * `Loop` restarts its children's local frame every `durationInFrames`, so a
   * translation computed from that local frame scrolls forever without any
   * wall-clock timer. The row is drawn twice so the gap between end and start
   * is never visible.
   */
  import {
    AbsoluteFill,
    Loop,
    getMotionContext,
    interpolate,
  } from "@svelte-motion/core";
  import type { LoopTickerProps } from "./props.js";

  let {
    heading = "Built with",
    items = ["Svelte 5", "Vite+", "Bun", "Playwright", "FFmpeg"],
  }: LoopTickerProps = $props();

  const motion = getMotionContext();
  const frame = $derived(motion.frame);

  /** One full pass of the row. At 30 fps this is two seconds. */
  const CYCLE = 60;
  /**
   * Width of one copy of the row. It has to exceed the 1920px frame, otherwise
   * the strip runs out of content and shows empty space on the right.
   */
  const ROW_WIDTH = 2400;

  const clamp = {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  } as const;

  // The heading settles in over the first 20 frames and then stays.
  const headingOpacity = $derived(interpolate(frame, [0, 20], [0, 1], clamp));
</script>

{#snippet row()}
  <div class="flex w-[2400px] shrink-0 items-center justify-around">
    {#each items as item (item)}
      <span
        class="rounded-full border border-neutral-700 px-8 py-4 text-3xl font-medium text-neutral-200"
      >
        {item}
      </span>
    {/each}
  </div>
{/snippet}

<AbsoluteFill class="items-center justify-center gap-16 bg-neutral-950">
  <p
    class="text-2xl font-medium tracking-[0.3em] text-neutral-500 uppercase"
    style="opacity: {headingOpacity};"
  >
    {heading}
  </p>

  <div class="relative w-full overflow-hidden">
    <!--
      `Loop` rewrites the frame its children see. Reading it here means the
      scroll is a pure function of the frame: sending the renderer to frame 300
      produces exactly the position it would reach by playing there.
    -->
    <Loop durationInFrames={CYCLE}>
      {#snippet children({ frame: local })}
        {@const shift = (local / CYCLE) * ROW_WIDTH}

        <div
          class="flex w-[4800px] gap-0"
          style="transform: translateX({-shift}px);"
        >
          {@render row()}
          {@render row()}
        </div>
      {/snippet}
    </Loop>
  </div>
</AbsoluteFill>
