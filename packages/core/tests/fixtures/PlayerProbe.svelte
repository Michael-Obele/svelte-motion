<script lang="ts">
  import { getMotionContext } from "../../src/lib/motion/context.svelte.js";

  const motion = getMotionContext();
  const frame = $derived(motion.frame);
</script>

<span data-probe="player" data-frame={frame}></span>
