<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    width,
    height,
    background = "#000",
    children,
  }: {
    width: number;
    height: number;
    background?: string;
    children: Snippet;
  } = $props();
</script>

<div
  class="svelte-motion-root"
  style:width="{width}px"
  style:height="{height}px"
  style:background
>
  {@render children()}
</div>

<style>
  .svelte-motion-root {
    position: relative;
    overflow: hidden;
    /* A composition is a picture, not a page: no scroll anchoring, no text
       reflow surprises between frames. */
    contain: strict;
  }
</style>
