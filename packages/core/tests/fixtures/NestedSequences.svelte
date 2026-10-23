<script lang="ts">
  /**
   * Test fixture: a `MotionRoot` with two nested `Sequence`s.
   *
   * Each level reports the frame twice — once through the snippet argument
   * (`children({ frame })`) and once through the motion context, using
   * `<FrameProbe>`. Both channels must agree.
   */
  import MotionRoot from "../../src/lib/motion/MotionRoot.svelte";
  import Sequence from "../../src/lib/timeline/Sequence.svelte";
  import FrameProbe from "./FrameProbe.svelte";

  let { initialFrame }: { initialFrame: number } = $props();
</script>

<MotionRoot fps={30} width={1920} height={1080} durationInFrames={90} {initialFrame}>
  <FrameProbe label="root" />

  <Sequence from={30}>
    {#snippet children({ frame: outer })}
      <span data-snippet="outer" data-frame={outer}></span>
      <FrameProbe label="outer" />

      <Sequence from={10}>
        {#snippet children({ frame: inner })}
          <span data-snippet="inner" data-frame={inner}></span>
          <FrameProbe label="inner" />
        {/snippet}
      </Sequence>
    {/snippet}
  </Sequence>
</MotionRoot>
