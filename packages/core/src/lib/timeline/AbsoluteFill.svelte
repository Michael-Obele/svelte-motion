<script lang="ts">
  /**
   * Fills the composition exactly, whatever the parent layout is doing.
   *
   * The `style` prop is a string, not an object, because it is concatenated into
   * the element's style attribute on every frame — building objects per frame is
   * measurable in a 30 fps render loop.
   *
   * `class` is passed through untouched. Core does no styling of its own beyond
   * the fill rules below, so this is what lets a composition written with
   * Tailwind, or any other class-based CSS, put its utilities on the root
   * element. Omitting it emits no class attribute at all, so existing
   * compositions render the same DOM as before.
   */
  import type { Snippet } from "svelte";

  let {
    style = "",
    class: className = "",
    children,
  }: { style?: string; class?: string; children: Snippet } = $props();
</script>

<div class="svelte-motion-absolute-fill {className}" {style}>
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
