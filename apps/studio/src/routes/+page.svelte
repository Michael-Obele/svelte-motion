<script module lang="ts">
  /**
   * The Studio index: composition picker, preview Player, scrubber, timeline.
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
</script>

<script lang="ts">
  import { goto } from "$app/navigation";
  import { page } from "$app/state";
  import { Player } from "@svelte-motion/core";
  import { clampFrame, formatDuration } from "#lib";

  const requestedId = page.url.searchParams.get("composition");
  const isKnownId = (id: string | null): id is string =>
    id !== null && compositions.some((composition) => composition.id === id);

  let activeId = $state(isKnownId(requestedId) ? requestedId : (compositions[0]?.id ?? ""));
  let frame = $state(0);
  let playerRef: {
    play: () => void;
    pause: () => void;
    seek: (frame: number) => void;
  } | null = $state(null);

  const active = $derived(compositions.find((composition) => composition.id === activeId));
  const duration = $derived(active?.durationInFrames ?? 0);
  const fps = $derived(active?.fps ?? 30);
  const playhead = $derived(
    duration > 0 ? (clampFrame(frame, duration) / duration) * 100 : 0,
  );
  const tickCount = $derived(fps > 0 ? Math.floor(duration / fps) : 0);
  const ticks = $derived(Array.from({ length: tickCount + 1 }, (_, second) => second));

  const seekTo = (next: number): void => {
    const api = playerRef as { seek: (frame: number) => void } | null;
    api?.seek(clampFrame(next, duration));
  };

  const select = (id: string): void => {
    if (id === activeId) return;
    activeId = id;
    frame = 0;
    goto(`?composition=${encodeURIComponent(id)}`, {
      replaceState: true,
      keepFocus: true,
      noScroll: true,
    });
  };
</script>

<div class="flex h-screen bg-studio text-ink">
  <aside class="w-72 shrink-0 overflow-y-auto border-r border-line bg-panel p-4">
    <h1 class="px-2 text-sm font-semibold tracking-wide text-muted uppercase">
      Compositions
    </h1>
    <ul class="mt-3 space-y-1">
      {#each compositions as composition (composition.id)}
        <li>
          <button
            type="button"
            onclick={() => select(composition.id)}
            aria-current={composition.id === activeId ? "true" : undefined}
            class="w-full rounded px-2 py-2 text-left hover:bg-studio {composition.id ===
            activeId
              ? 'bg-studio ring-1 ring-accent'
              : ''}"
          >
            <span class="block truncate text-sm font-medium">{composition.id}</span>
            <span class="mt-0.5 block text-xs text-muted">
              {composition.width}x{composition.height} · {composition.fps} fps ·
              {composition.durationInFrames} frames
            </span>
          </button>
        </li>
      {/each}
    </ul>
  </aside>

  <main class="flex-1 overflow-y-auto p-6">
    {#if active}
      {@const Component = active.component}
      <h2 class="text-lg font-semibold">{active.id}</h2>
      <p class="mt-1 text-sm text-muted">
        {active.width}x{active.height} · {active.fps} fps · {formatDuration(
          active.durationInFrames,
          active.fps,
        )}
      </p>

      <div class="mt-4 overflow-auto">
        {#key active.id}
          <Player
            bind:this={playerRef}
            component={Component}
            inputProps={(active.defaultProps ?? {}) as Record<string, unknown>}
            fps={active.fps}
            width={active.width}
            height={active.height}
            durationInFrames={active.durationInFrames}
            startFrame={0}
            loop={true}
            controls={true}
            onFrame={(next) => {
              frame = next;
            }}
          />
        {/key}
      </div>

      <div class="mt-4 flex items-center gap-3">
        <input
          type="range"
          min="0"
          max={Math.max(0, active.durationInFrames - 1)}
          step="1"
          value={frame}
          aria-label="Scrub frame"
          class="flex-1 accent-accent"
          oninput={(event) => seekTo(Number((event.currentTarget as HTMLInputElement).value))}
        />
        <span class="text-xs whitespace-nowrap text-muted">
          frame {frame} / {active.durationInFrames}
        </span>
        <span class="text-xs whitespace-nowrap text-muted">{active.fps} fps</span>
      </div>

      <!-- Sequence nesting bars: blocked on a timeline registry (see plan M5) -->
      <div class="relative mt-2 h-10 rounded border border-line bg-panel">
        {#each ticks as second (second)}
          <div
            class="absolute top-0 bottom-0 w-px bg-line"
            style="left: {(second * active.fps / active.durationInFrames) * 100}%"
          ></div>
        {/each}
        <div
          class="absolute top-0 bottom-0 w-0.5 bg-accent"
          style="left: {playhead}%"
        ></div>
      </div>
      <p class="mt-1 text-xs text-muted">
        {formatDuration(active.durationInFrames, active.fps)} total
      </p>
    {:else}
      <p class="text-sm text-muted">No compositions registered.</p>
    {/if}
  </main>
</div>

