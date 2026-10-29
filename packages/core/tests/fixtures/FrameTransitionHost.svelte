<script lang="ts">
  /**
   * Test fixture: `frameTransition` in the shapes that matter.
   *
   * - on the root timeline, before / during / after its window
   * - with `direction: "out"`
   * - inside a `Sequence`, where the frame the action reads is the *local* one
   * - driven by a real Svelte factory (`fly`) rather than a test stand-in
   *
   * The `Sequence` case doubles as the deferred-mount test: its children are
   * created when the frame enters the window, i.e. during an update rather than
   * during component initialisation, which is where `getContext` is documented to
   * work. If the action could not resolve its context there, the element would
   * never animate.
   */
  import { fly } from "svelte/transition";
  import MotionRoot from "../../src/lib/motion/MotionRoot.svelte";
  import Sequence from "../../src/lib/timeline/Sequence.svelte";
  import {
    frameTransition,
    type FrameTransitionOptions,
  } from "../../src/lib/motion/frame-transition.svelte.js";

  /**
   * Deterministic stand-in for `fade`: linear, opacity only, no millisecond
   * maths and no reliance on jsdom's computed styles, so the numbers in the
   * assertions are exactly what the frame says.
   */
  const linearFade = () => ({
    easing: (t: number): number => t,
    css: (t: number): string => `opacity: ${t}`,
  });

  /*
   * Hoisted on purpose. These are plain consts, not template literals, so the
   * action's `update` never fires when the surrounding block re-renders on each
   * seek — the factory (and any node measurement it does) runs once.
   */
  const rootFade: FrameTransitionOptions = { fn: linearFade, from: 10, durationInFrames: 10 };
  const outFade: FrameTransitionOptions = {
    fn: linearFade,
    from: 0,
    durationInFrames: 10,
    direction: "out",
  };
  const sequenceFade: FrameTransitionOptions = { fn: linearFade, from: 5, durationInFrames: 10 };
  const flown: FrameTransitionOptions = {
    fn: fly,
    params: { y: 200, easing: (t: number): number => t },
    from: 0,
    durationInFrames: 10,
  };
</script>

<MotionRoot fps={30} width={1920} height={1080} durationInFrames={120} initialFrame={0}>
  <div data-ft="root" use:frameTransition={rootFade}>root</div>
  <div data-ft="out" use:frameTransition={outFade}>out</div>
  <div data-ft="fly" use:frameTransition={flown}>fly</div>

  <Sequence from={30} durationInFrames={60}>
    <div data-ft="sequence" use:frameTransition={sequenceFade}>sequence</div>
  </Sequence>
</MotionRoot>
