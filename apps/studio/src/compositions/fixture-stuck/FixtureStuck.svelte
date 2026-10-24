<script lang="ts">
  import { AbsoluteFill, delayRender } from "@svelte-motion/core";

  // Opens a handle and never continues — the renderer must time out and name it.
  let stuckHandle: number | null = null;
  if (stuckHandle === null) {
    stuckHandle = delayRender("e2e-stuck-fixture");
  }
</script>

<AbsoluteFill style="background: #0b1020; align-items: center; justify-content: center;">
  <p style="color: #f8fafc; font-family: system-ui, sans-serif; font-size: 32px;">stuck fixture — never ready</p>
</AbsoluteFill>
