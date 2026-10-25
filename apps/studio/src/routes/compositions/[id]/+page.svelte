<script module lang="ts">
  /**
   * Composition detail: Player plus a JSON props editor.
   *
   * Authoring chrome only — the `/render` and `/player` pixel surfaces are
   * untouched, so the determinism and player-parity gates measure the same
   * pixels as before Tailwind.
   */
  import { collectCompositions } from "@svelte-motion/core";

  // The app owns the glob. `import.meta.glob` is resolved relative to the module
  // that contains it, so a glob living inside `@svelte-motion/core` would only ever
  // see core's own files.
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
  import { page } from "$app/state";
  import { getComposition } from "@svelte-motion/core";
  import PropsEditor from "./PropsEditor.svelte";

  const compositionId = $derived(page.params.id ?? "");
  const composition = $derived(getComposition(compositionId));
</script>

<div class="min-h-screen bg-studio p-6 text-ink">
  {#if composition}
    <a href="/" class="text-sm text-accent hover:underline">← All compositions</a>
    <h1 class="mt-2 text-lg font-semibold">{composition.id}</h1>
    <p class="mt-1 text-sm text-muted">
      {composition.width}x{composition.height} · {composition.fps} fps ·
      {composition.durationInFrames} frames
    </p>

    <!--
      Keyed by id so navigating to another composition destroys the editor and
      re-runs its state initialisers — the draft, applied props and error all
      belong to one composition.
    -->
    {#key composition.id}
      <PropsEditor {composition} />
    {/key}
  {:else}
    <h1 class="text-lg font-semibold">Unknown composition</h1>
    <p class="mt-2 text-sm text-muted">
      No composition is registered with the id
      <code class="text-ink">{compositionId === "" ? "(missing)" : compositionId}</code>.
    </p>
    <p class="mt-2 text-sm text-muted">Available ids:</p>
    <ul class="mt-1 list-disc pl-6 text-sm">
      {#each compositionIds as id (id)}
        <li><code class="text-ink">{id}</code></li>
      {/each}
    </ul>
  {/if}
</div>
