<script lang="ts">
  /**
   * Fills the composition exactly, whatever the parent layout is doing.
   *
   * The `style` prop is a string, not an object, because it is concatenated into
   * the element's style attribute on every frame — building objects per frame is
   * measurable in a 30 fps render loop.
   */
  import type { Snippet } from "svelte";

  let { style = "", children }: { style?: string; children: Snippet } = $props();
</script>

<div class="svelte-motion-absolute-fill" style={style}>
  {@render children()}
</div>

<style>
  .svelte-motion-absolute-fill {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
  }
</style>
