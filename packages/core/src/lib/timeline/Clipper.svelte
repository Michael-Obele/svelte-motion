<script lang="ts">
  /** Clips overflowing children, like Remotion's `<Clipper>`. */
  import type { Snippet } from "svelte";

  let {
    width,
    height,
    style = "",
    children,
  }: { width?: number; height?: number; style?: string; children: Snippet } = $props();
</script>

<div
  class="svelte-motion-clipper"
  style:width={width === undefined ? undefined : `${width}px`}
  style:height={height === undefined ? undefined : `${height}px`}
  style={style}
>
  {@render children()}
</div>

<style>
  .svelte-motion-clipper {
    overflow: hidden;
    position: relative;
  }
</style>
