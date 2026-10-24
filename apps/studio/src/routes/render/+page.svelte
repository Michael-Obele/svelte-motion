<script module lang="ts">
  /**
   * The render host.
   *
   * `/render?composition=<id>&frame=<n>&props=<url-encoded JSON>` draws exactly one
   * frame of exactly one composition, with no chrome around it, so a headless
   * browser can screenshot it. The M2 renderer drives this URL per frame.
   */
  import * as v from "valibot";
  import {
    collectCompositions,
    getCompositions,
    setSvelteMotionEnvironmentFlag,
  } from "@svelte-motion/core";

  // The app owns the glob. `import.meta.glob` is resolved relative to the module
  // that contains it, so a glob living inside `@svelte-motion/core` would only ever
  // see core's own files.
  const compositions = collectCompositions(
    import.meta.glob("/src/compositions/*/index.ts", { eager: true }) as Record<
      string,
      { default?: unknown }
    >,
  );

  // Set before anything mounts — the same handshake the renderer performs. It has
  // to happen at module scope: unknown ids never mount a MotionRoot, and the flag
  // still describes the shell they are drawn in.
  setSvelteMotionEnvironmentFlag("svelteMotion_isRendering", true);

  /** Ids in registration order, for the unknown-composition page. */
  const compositionIds = compositions.map((composition) => composition.id);
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/state";
  import { getComposition, MotionRoot, type CompositionConfig } from "@svelte-motion/core";

  const params = $derived(page.url.searchParams);
  const compositionId = $derived(params.get("composition") ?? "");
  const composition = $derived(getComposition(compositionId));

  /** `?frame=` — integer, default 0. Anything unusable falls back to 0. */
  const parseFrame = (raw: string | null): number => {
    const parsed = Number.parseInt(raw ?? "0", 10);

    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  };

  /** `?props=` — URL-encoded JSON object, default the composition's `defaultProps`. */
  const parseProps = (
    raw: string | null,
    config: CompositionConfig | undefined,
  ): Record<string, unknown> => {
    if (raw !== null && raw !== "") {
      try {
        const parsed: unknown = JSON.parse(raw);

        if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
          return parsed as Record<string, unknown>;
        }
      } catch {
        // A malformed `?props=` is a caller error, not a page crash: fall through
        // to the defaults so the frame still renders and the mistake is visible.
      }
    }

    return (config?.defaultProps ?? {}) as Record<string, unknown>;
  };

  const frame = $derived(parseFrame(params.get("frame")));
  const rawProps = $derived(params.get("props"));
  const hasPropsParam = $derived(rawProps !== null && rawProps !== "");
  const parsedProps = $derived(parseProps(rawProps, composition));

  const formatIssues = (
    issues: readonly { path?: readonly { key: unknown }[]; message: string }[],
  ): string =>
    issues
      .map((issue) => {
        const path = issue.path?.map((item) => String(item.key)).join(".");
        return `${path === undefined || path === "" ? "(root)" : path}: ${issue.message}`;
      })
      .join("; ");

  const validationError = $derived.by(() => {
    if (composition === undefined) return undefined;
    if (composition.schema === undefined) return undefined;
    if (!hasPropsParam) return undefined;
    const result = v.safeParse(composition.schema, parsedProps);
    if (result.success) return undefined;
    return formatIssues(result.issues);
  });

  const inputProps = $derived(
    validationError === undefined ? parsedProps : (composition?.defaultProps ?? {}),
  );

  // Expose validation error for the renderer to read before the ready wait.
  $effect(() => {
    const bridge = window as unknown as Record<string, unknown>;
    if (validationError !== undefined) {
      bridge.svelteMotion_validationError = validationError;
    } else {
      bridge.svelteMotion_validationError = undefined;
    }
  });

  // Renderer-facing globals. `svelteMotion_getCompositions` lets a driver list what
  // it can render; `svelteMotion_inputProps` echoes the props actually in use, so a
  // render can be reproduced from its own page.
  onMount(() => {
    const bridge = window as unknown as Record<string, unknown>;
    bridge.svelteMotion_getCompositions = () => getCompositions();
    bridge.svelteMotion_inputProps = inputProps;

    return () => {
      delete bridge.svelteMotion_getCompositions;
      delete bridge.svelteMotion_inputProps;
      delete bridge.svelteMotion_validationError;
    };
  });
</script>

{#if validationError !== undefined}
  <main class="error">
    <h1>Invalid props</h1>
    <p>Composition <code>{compositionId}</code> props failed validation:</p>
    <p><code>{validationError}</code></p>
  </main>
{:else if composition}
  {@const Component = composition.component}
  <MotionRoot
    fps={composition.fps}
    width={composition.width}
    height={composition.height}
    durationInFrames={composition.durationInFrames}
    initialFrame={frame}
  >
    <Component {...inputProps} />
  </MotionRoot>
{:else}
  <main class="error">
    <h1>Unknown composition</h1>
    <p>
      No composition is registered with the id <code>{compositionId === "" ? "(missing)" : compositionId}</code>.
    </p>
    <p>Available ids:</p>
    <ul>
      {#each compositionIds as id (id)}
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
