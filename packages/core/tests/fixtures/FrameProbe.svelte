<script lang="ts">
  /**
   * Test fixture: reports the frame it sees through the motion context.
   *
   * `getMotionContext()` is called at init (that is where `getContext` is legal)
   * and `frame` is then read inside a `$derived`, which is what keeps the value
   * reactive as the renderer moves the frame.
   */
  import {
    getMotionContext,
    useCurrentFrame,
    useVideoConfig,
  } from "../../src/lib/motion/context.svelte.js";

  let { label }: { label: string } = $props();

  const motion = getMotionContext();
  const frame = $derived(motion.frame);
  const config = useVideoConfig();

  // `useCurrentFrame()` is the convenience wrapper; it reads the context once,
  // so its value is the frame at the moment the component was created.
  const initialFrame = useCurrentFrame();
</script>

<span
  data-probe={label}
  data-frame={frame}
  data-initial-frame={initialFrame}
  data-fps={config.fps}
  data-width={config.width}
  data-height={config.height}
  data-duration={config.durationInFrames}
></span>
