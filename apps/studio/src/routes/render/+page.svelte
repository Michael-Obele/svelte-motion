<script module lang="ts">
  /**
   * The render host route.
   *
   * `/render?composition=<id>&frame=<n>&props=<url-encoded JSON>` draws exactly one
   * frame of exactly one composition, with no chrome around it, so a headless
   * browser can screenshot it. The M2 renderer drives this URL per frame.
   *
   * The app owns the glob and the URL. The pixels come from `<RenderHost>` in
   * `@svelte-motion/studio-ui`, which the examples app mounts from an identical
   * route — so the two servers cannot drift apart.
   */
  import { collectCompositions } from "@svelte-motion/core";

  const compositions = collectCompositions(
    import.meta.glob("/src/compositions/*/index.ts", { eager: true }) as Record<
      string,
      { default?: unknown }
    >,
  );

  /** Ids in registration order, for the unknown-composition page. */
  const compositionIds = compositions.map((composition) => composition.id);
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import {
    getComposition,
    getCompositions,
    setSvelteMotionEnvironmentFlag,
  } from "@svelte-motion/core";
  import { RenderHost, resolveHostProps } from "@svelte-motion/studio-ui";

  const params = $derived(page.url.searchParams);
  const compositionId = $derived(params.get("composition") ?? "");
  const composition = $derived(getComposition(compositionId));
  const host = $derived(resolveHostProps(composition, params));

  // Expose validation error for the renderer to read before the ready wait.
  $effect(() => {
    const bridge = window as unknown as Record<string, unknown>;
    if (host.validationError !== undefined) {
      bridge.svelteMotion_validationError = host.validationError;
    } else {
      bridge.svelteMotion_validationError = undefined;
    }
  });

  // Renderer-facing globals. `svelteMotion_getCompositions` lets a driver list what
  // it can render; `svelteMotion_inputProps` echoes the props actually in use, so a
  // render can be reproduced from its own page.
  onMount(() => {
    // The flag describes the mounted surface, so it must not outlive this route:
    // otherwise navigating to `/player` leaves both flags true.
    setSvelteMotionEnvironmentFlag("svelteMotion_isRendering", true);

    const bridge = window as unknown as Record<string, unknown>;
    bridge.svelteMotion_getCompositions = () => getCompositions();
    bridge.svelteMotion_inputProps = host.inputProps;

    return () => {
      setSvelteMotionEnvironmentFlag("svelteMotion_isRendering", false);
      delete bridge.svelteMotion_getCompositions;
      delete bridge.svelteMotion_inputProps;
      delete bridge.svelteMotion_validationError;
    };
  });
</script>

<RenderHost
  {composition}
  {compositionId}
  frame={host.frame}
  inputProps={host.inputProps}
  validationError={host.validationError}
  availableIds={compositionIds}
/>
