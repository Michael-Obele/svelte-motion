<script lang="ts">
  /**
   * The render host: exactly one frame of exactly one composition, no chrome.
   *
   * A headless browser screenshots this, so the DOM here *is* the picture. It is a
   * component rather than a route so every app can serve the same pixel surface:
   * the route reads its own URL, validates, then hands the resolved values down.
   *
   * Every prop is already resolved, on purpose. `frame` and `inputProps` come from
   * the caller's `?frame=` / `?props=`, and `validationError` is computed there with
   * that app's own schema. Nothing here touches `$app/*`, so `apps/studio` and
   * `examples` can both mount it and render byte-identical frames.
   */
  import { MotionRoot, type CompositionConfig } from "@svelte-motion/core";

  let {
    composition,
    compositionId,
    frame,
    inputProps,
    validationError,
    availableIds,
  }: {
    composition: CompositionConfig | undefined;
    compositionId: string;
    frame: number;
    inputProps: Record<string, unknown>;
    validationError?: string;
    /** Ids in registration order, listed when `compositionId` is unknown. */
    availableIds: string[];
  } = $props();
</script>

{#if validationError !== undefined}
  <main class="error">
    <h1>Invalid props</h1>
    <p>Composition <code>{compositionId}</code> props failed validation:</p>
    <p><code>{validationError}</code></p>
  </main>
{:else if composition}
  {@const Component = composition.component}
  <!--
    `MotionRoot` reads its config once, so a config change has to remount it.
    The frame is deliberately not in the key: the renderer drives frames through
    `window.svelteMotion_setFrame`, and remounting per frame would destroy render
    throughput.
  -->
  {@const identity = `${composition.id}:${composition.fps}:${composition.width}:${composition.height}:${composition.durationInFrames}`}
  {#key identity}
    <MotionRoot
      fps={composition.fps}
      width={composition.width}
      height={composition.height}
      durationInFrames={composition.durationInFrames}
      initialFrame={frame}
    >
      <Component {...inputProps} />
    </MotionRoot>
  {/key}
{:else}
  <main class="error">
    <h1>Unknown composition</h1>
    <p>
      No composition is registered with the id <code>{compositionId === "" ? "(missing)" : compositionId}</code>.
    </p>
    <p>Available ids:</p>
    <ul>
      {#each availableIds as id (id)}
        <li><code>{id}</code></li>
      {/each}
    </ul>
  </main>
{/if}

<style>
  .error {
    padding: 32px;
    color: #f8fafc;
    background: #0b1020;
    font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  }
</style>
