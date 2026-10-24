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
  import { getComposition, Player } from "@svelte-motion/core";
  import { safeParse } from "valibot";

  const compositionId = $derived(page.params.id ?? "");
  const composition = $derived(getComposition(compositionId));

  const stringify = (value: unknown): string => JSON.stringify(value ?? {}, null, 2);

  let draft = $state("");
  let draftFor = $state("");
  let appliedProps = $state<Record<string, unknown>>({});
  let error = $state<string | undefined>(undefined);

  /** Keep the editor in sync when navigating between compositions. */
  $effect(() => {
    if (composition !== undefined && draftFor !== composition.id) {
      draftFor = composition.id;
      draft = stringify(composition.defaultProps);
      appliedProps = (composition.defaultProps ?? {}) as Record<string, unknown>;
      error = undefined;
    }
  });

  const formatIssues = (
    issues: readonly { path?: readonly { key: unknown }[]; message: string }[],
  ): string =>
    issues
      .map((issue) => {
        const path = issue.path?.map((item) => String(item.key)).join(".");
        return `${path === undefined || path === "" ? "(root)" : path}: ${issue.message}`;
      })
      .join("; ");

  const apply = (): void => {
    if (composition === undefined) return;

    let parsed: unknown;

    try {
      parsed = JSON.parse(draft);
    } catch {
      error = "Invalid JSON: could not parse the props object.";
      return;
    }

    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      error = "Invalid JSON: props must be a JSON object.";
      return;
    }

    if (composition.schema !== undefined) {
      const result = safeParse(composition.schema, parsed);

      if (!result.success) {
        error = formatIssues(result.issues);
        return;
      }
    }

    error = undefined;
    appliedProps = parsed as Record<string, unknown>;
  };
</script>

<div class="min-h-screen bg-studio p-6 text-ink">
  {#if composition}
    {@const Component = composition.component}
    <a href="/" class="text-sm text-accent hover:underline">← All compositions</a>
    <h1 class="mt-2 text-lg font-semibold">{composition.id}</h1>
    <p class="mt-1 text-sm text-muted">
      {composition.width}x{composition.height} · {composition.fps} fps ·
      {composition.durationInFrames} frames
    </p>

    <div class="mt-4 overflow-auto">
      {#key `${composition.id}-${JSON.stringify(appliedProps)}`}
        <Player
          component={Component}
          inputProps={appliedProps}
          fps={composition.fps}
          width={composition.width}
          height={composition.height}
          durationInFrames={composition.durationInFrames}
          startFrame={0}
          loop={true}
          controls={true}
        />
      {/key}
    </div>

    <div class="mt-4 max-w-2xl">
      <label for="props-editor" class="text-sm font-medium">Props (JSON)</label>
      <textarea
        id="props-editor"
        rows="8"
        bind:value={draft}
        spellcheck="false"
        class="mt-1 w-full rounded border border-line bg-panel p-3 font-mono text-sm text-ink"
      ></textarea>
      <div class="mt-2 flex items-center gap-3">
        <button
          type="button"
          onclick={apply}
          class="rounded bg-accent px-4 py-1.5 text-sm font-medium text-studio"
        >
          Apply
        </button>
        {#if error !== undefined}
          <p class="text-sm text-red-400">{error}</p>
        {/if}
      </div>
    </div>
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
