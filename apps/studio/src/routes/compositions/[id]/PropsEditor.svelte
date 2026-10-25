<script lang="ts">
  /**
   * JSON props editor for one composition.
   *
   * The draft and the applied props both belong to *a* composition, so this
   * component is mounted inside a `{#key composition.id}` block by its parent.
   * That is how the editor resets on navigation: a new key destroys this
   * instance and its `$state` initialisers run again. Doing the same with an
   * `$effect` would mean writing state from an effect, which is the pattern
   * Svelte recommends against.
   */
  import { untrack } from "svelte";
  import { Player, type CompositionConfig } from "@svelte-motion/core";
  import { safeParse } from "valibot";

  let { composition }: { composition: CompositionConfig } = $props();

  const stringify = (value: unknown): string => JSON.stringify(value ?? {}, null, 2);

  // `untrack` makes the intent explicit: this component is re-created by the
  // parent's `{#key composition.id}`, so these are init-only reads of a prop
  // that never changes under a given instance.
  let draft = $state(untrack(() => stringify(composition.defaultProps)));
  let appliedProps = $state<Record<string, unknown>>(
    untrack(() => (composition.defaultProps ?? {}) as Record<string, unknown>),
  );
  let error = $state<string | undefined>(undefined);

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

<div class="mt-4 overflow-auto">
  <!--
    Re-mount the Player whenever the applied props change: it owns its frame
    state, so a new props object has to start a new playback session.
  -->
  {#key JSON.stringify(appliedProps)}
    {@const Component = composition.component}
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
