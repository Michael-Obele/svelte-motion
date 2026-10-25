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
        import.meta.glob(
            ["/src/compositions/*/index.ts", "../../../../examples/*/index.ts"],
            { eager: true },
        ) as Record<string, { default?: unknown }>,
    );
</script>

<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import { Player } from "@svelte-motion/core";
    import { clampFrame, formatDuration } from "#lib";

    const requestedId = page.url.searchParams.get("composition");
    const isKnownId = (id: string | null): id is string =>
        id !== null &&
        compositions.some((composition) => composition.id === id);

    let activeId = $state(
        isKnownId(requestedId) ? requestedId : (compositions[0]?.id ?? ""),
    );
    let frame = $state(0);
    let isPlaying = $state(false);
    let playerRef: {
        play: () => void;
        pause: () => void;
        seek: (frame: number) => void;
    } | null = $state(null);

    const active = $derived(
        compositions.find((composition) => composition.id === activeId),
    );
    const duration = $derived(active?.durationInFrames ?? 0);
    const fps = $derived(active?.fps ?? 30);
    const playhead = $derived(
        duration > 0 ? (clampFrame(frame, duration) / duration) * 100 : 0,
    );
    const tickCount = $derived(fps > 0 ? Math.floor(duration / fps) : 0);
    const ticks = $derived(
        Array.from({ length: tickCount + 1 }, (_, second) => second),
    );

    const seekTo = (next: number): void => {
        const api = playerRef as { seek: (frame: number) => void } | null;
        api?.seek(clampFrame(next, duration));
    };

    const select = (id: string): void => {
        if (id === activeId) return;
        activeId = id;
        frame = 0;
        goto(`?composition=${encodeURIComponent(id)}`, {
            // SvelteKit 3 collapsed `replaceState` + `keepFocus` + `noScroll` into
            // `replace` and `reset`. `reset: false` keeps scroll position and focus,
            // which is what a picker click needs: the list must not jump to the top.
            replace: true,
            reset: false,
        });
    };

    /*
     * Preview scale: fit, or an explicit zoom.
     *
     * A composition is a fixed 1920x1080 picture, so it cannot be laid out
     * responsively: at native size it overflows any window smaller than a 1080p
     * screen and the panel grows scrollbars mid-preview. Scaling the stage with
     * a transform keeps the pixels identical (a transform is a paint-time
     * operation) while the layout reserves only the scaled box.
     *
     * `zoom === null` means fit: shrink until the whole frame fits the panel,
     * never up. A number is an explicit scale, so 100% shows real pixel size and
     * the panel scrolls.
     */
    const GUTTER = 32; // the panel's p-4 padding, both sides
    let previewBox = $state<HTMLDivElement | null>(null);
    let previewScale = $state(1);
    let zoom = $state<number | null>(null);

    const scale = $derived(zoom ?? previewScale);
    const zoomPercent = $derived(Math.round(scale * 100));
    const atFit = $derived(zoom === null);

    const clampScale = (value: number): number =>
        Math.min(4, Math.max(0.1, Math.round(value * 100) / 100));

    const zoomIn = (): void => {
        zoom = clampScale(scale * 1.25);
    };

    // Stepping out of fit starts from the fitted size, so the first click always
    // shrinks the picture instead of jumping past it.
    const zoomOut = (): void => {
        zoom = clampScale(scale / 1.25);
    };

    const zoomToFit = (): void => {
        zoom = null;
    };

    const togglePlay = (): void => {
        const api = playerRef as { play: () => void; pause: () => void } | null;

        if (api === null) return;

        if (isPlaying) {
            api.pause();
        } else {
            api.play();
        }
    };

    $effect(() => {
        const box = previewBox;
        const target = active;

        if (!box || !target) {
            return;
        }

        const measure = (): void => {
            const width = box.clientWidth - GUTTER;
            const height = box.clientHeight - GUTTER;

            if (width <= 0 || height <= 0) {
                return;
            }

            previewScale = Math.min(
                width / target.width,
                height / target.height,
                1,
            );
        };

        measure();

        const observer = new ResizeObserver(measure);
        observer.observe(box);

        return () => observer.disconnect();
    });
</script>

<div class="flex h-screen bg-studio text-ink">
    <aside
        class="w-72 shrink-0 overflow-y-auto border-r border-line bg-panel p-4"
    >
        <h1
            class="px-2 text-sm font-semibold tracking-wide text-muted uppercase"
        >
            Compositions
        </h1>
        <ul class="mt-3 space-y-1">
            {#each compositions as composition (composition.id)}
                <li>
                    <button
                        type="button"
                        onclick={() => select(composition.id)}
                        aria-current={composition.id === activeId
                            ? "true"
                            : undefined}
                        class="w-full rounded px-2 py-2 text-left hover:bg-studio {composition.id ===
                        activeId
                            ? 'bg-studio ring-1 ring-accent'
                            : ''}"
                    >
                        <span class="block truncate text-sm font-medium"
                            >{composition.id}</span
                        >
                        <span class="mt-0.5 block text-xs text-muted">
                            {composition.width}x{composition.height} · {composition.fps}
                            fps ·
                            {composition.durationInFrames} frames
                        </span>
                    </button>
                </li>
            {/each}
        </ul>
    </aside>

    <main class="flex min-h-0 min-w-0 flex-1 flex-col p-6">
        {#if active}
            {@const Component = active.component}
            <h2 class="text-lg font-semibold">{active.id}</h2>
            <p class="mt-1 text-sm text-muted">
                {active.width}x{active.height} · {active.fps} fps · {formatDuration(
                    active.durationInFrames,
                    active.fps,
                )}
            </p>

            <!-- Transport. The Player's built-in controls are off because
                 the studio draws its own; without this row there was no way to
                 start playback at all. -->
            <div class="mt-4 flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onclick={togglePlay}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    class="rounded border border-line bg-panel px-4 py-1.5 text-sm font-medium transition-colors hover:border-accent hover:text-accent"
                >
                    {isPlaying ? "Pause" : "Play"}
                </button>

                <span class="ml-1 text-xs tabular-nums text-muted">
                    frame {frame} / {active.durationInFrames}
                </span>
                <span class="text-xs text-muted">{active.fps} fps</span>

                <div class="ml-auto flex items-center gap-1">
                    <button
                        type="button"
                        onclick={zoomOut}
                        aria-label="Zoom out"
                        class="h-7 w-7 rounded border border-line bg-panel text-sm leading-none hover:border-accent hover:text-accent"
                    >
                        −
                    </button>
                    <span
                        class="w-14 text-center text-xs tabular-nums text-muted"
                        aria-live="polite"
                    >
                        {zoomPercent}%
                    </span>
                    <button
                        type="button"
                        onclick={zoomIn}
                        aria-label="Zoom in"
                        class="h-7 w-7 rounded border border-line bg-panel text-sm leading-none hover:border-accent hover:text-accent"
                    >
                        +
                    </button>
                    <button
                        type="button"
                        onclick={zoomToFit}
                        disabled={atFit}
                        class="ml-1 rounded border border-line bg-panel px-2 py-1 text-xs hover:border-accent hover:text-accent disabled:cursor-default disabled:opacity-40 disabled:hover:border-line disabled:hover:text-inherit"
                    >
                        Fit
                    </button>
                </div>
            </div>

            <!--
              The stage is sized by an explicit box, so zooming past the panel
              scrolls instead of stretching the layout. `safe center` keeps the
              scroll origin reachable: plain centring would clip the left and top
              edges once the content is larger than the panel.
            -->
            <div
                bind:this={previewBox}
                class="mt-3 flex min-h-0 flex-1 items-[safe_center] justify-[safe_center] overflow-auto rounded border border-line bg-studio p-4"
            >
                <div
                    class="shrink-0"
                    style="width: {active.width * scale}px; height: {active.height *
                        scale}px;"
                >
                    <div
                        class="origin-top-left"
                        style="width: {active.width}px; height: {active.height}px; transform:
                            scale({scale});"
                    >
                        {#key active.id}
                            <Player
                                bind:this={playerRef}
                                bind:isPlaying
                                component={Component}
                                inputProps={(active.defaultProps ??
                                    {}) as Record<string, unknown>}
                                fps={active.fps}
                                width={active.width}
                                height={active.height}
                                durationInFrames={active.durationInFrames}
                                startFrame={0}
                                loop={true}
                                controls={false}
                                onFrame={(next) => {
                                    frame = next;
                                }}
                            />
                        {/key}
                    </div>
                </div>
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
                    oninput={(event) =>
                        seekTo(
                            Number(
                                (event.currentTarget as HTMLInputElement).value,
                            ),
                        )}
                />
                <span class="text-xs whitespace-nowrap text-muted">
                    frame {frame} / {active.durationInFrames}
                </span>
                <span class="text-xs whitespace-nowrap text-muted"
                    >{active.fps} fps</span
                >
            </div>

            <!-- Sequence nesting bars: blocked on a timeline registry (see plan M5) -->
            <div class="relative mt-2 h-10 rounded border border-line bg-panel">
                {#each ticks as second (second)}
                    <div
                        class="absolute top-0 bottom-0 w-px bg-line"
                        style="left: {((second * active.fps) /
                            active.durationInFrames) *
                            100}%"
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
