<script lang="ts">
  /**
   * Font-heavy fixture for M3.
   *
   * Uses a local woff2 via @font-face, an <Img> from static, and a delayRender
   * + fetch of copy.json so the first frame can only be correct if readiness works.
   * The text node sets data-font-ready after document.fonts.check resolves, and
   * renders the fetched title (not a placeholder) on frame 0.
   */
  import { onMount } from "svelte";
  import { AbsoluteFill, delayRender, continueRender, Img, staticFile } from "@svelte-motion/core";

  let { title = "Fixture Font Heavy" }: { title?: string } = $props();

  let fetchedTitle = $state<string | null>(null);
  let fontReady = $state(false);

  const handle = delayRender("fixture-font-heavy: fetch copy.json");

  onMount(async () => {
    try {
      const response = await fetch(staticFile("data/copy.json"));
      const data = (await response.json()) as { title?: string };
      fetchedTitle = data.title ?? title;
    } catch {
      fetchedTitle = title;
    } finally {
      continueRender(handle);
    }

    // Check the custom font is available and mark the DOM.
    try {
      await document.fonts.ready;
      const available = document.fonts.check('12px "FixtureFont"');
      fontReady = available;
    } catch {
      fontReady = false;
    }
  });

  const displayTitle = $derived(fetchedTitle ?? title);
</script>

<svelte:head>
  <style>
    @font-face {
      font-family: "FixtureFont";
      src: url("/fonts/fixture-font.woff2") format("woff2");
      font-display: swap;
    }
  </style>
</svelte:head>

<AbsoluteFill style="background: #0b1020; align-items: center; justify-content: center; gap: 32px; flex-direction: column;">
  <Img src="images/checker.png" alt="checker" style="width: 240px; height: 240px;" />
  <h1
    class="fixture-title"
    data-font-ready={fontReady ? "true" : "false"}
    style="font-family: 'FixtureFont', system-ui, sans-serif; color: #f8fafc; font-size: 64px; font-weight: 600;"
  >
    {displayTitle}
  </h1>
</AbsoluteFill>

<style>
  .fixture-title {
    margin: 0;
    letter-spacing: -0.02em;
  }
</style>
