<script lang="ts">
    /**
     * Timeline: second ticks, one bar per mounted Sequence, playhead over all rows.
     *
     * Pure display: everything derives from props. No motion context, no `$app/*`.
     */
    import { clampFrame, formatDuration } from "./format.js";
    import type { TimelineProps } from "./studio-types.js";

    let { durationInFrames, fps, frame, sequences }: TimelineProps = $props();

    const playhead = $derived(
        durationInFrames > 0
            ? (clampFrame(frame, durationInFrames) / durationInFrames) * 100
            : 0,
    );
    const tickCount = $derived(
        fps > 0 ? Math.floor(durationInFrames / fps) : 0,
    );
    const ticks = $derived(
        Array.from({ length: tickCount + 1 }, (_, second) => second),
    );
    const rows = $derived(
        [...sequences].sort(
            (a, b) => a.depth - b.depth || a.absoluteFrom - b.absoluteFrom,
        ),
    );

    const leftPct = (absoluteFrom: number): number =>
        durationInFrames > 0
            ? Math.max(
                  0,
                  Math.min(100, (absoluteFrom / durationInFrames) * 100),
              )
            : 0;

    const widthPct = (
        absoluteFrom: number,
        length: number | undefined,
    ): number => {
        if (durationInFrames <= 0) return 0;
        const start = Math.max(0, absoluteFrom);
        const end =
            length === undefined ? durationInFrames : absoluteFrom + length;
        return Math.max(
            0,
            Math.min(
                100,
                ((Math.min(end, durationInFrames) - start) / durationInFrames) *
                    100,
            ),
        );
    };

    const describe = (
        absoluteFrom: number,
        length: number | undefined,
    ): string =>
        length === undefined
            ? `from ${absoluteFrom}, unbounded`
            : `from ${absoluteFrom}, ${length} frames`;
</script>

<div class="relative mt-2 rounded border border-line bg-panel p-2">
    <div class="relative h-3">
        {#each ticks as second (second)}
            <div
                class="absolute top-0 bottom-0 w-px bg-line"
                style="left: {((second * fps) / Math.max(1, durationInFrames)) *
                    100}%"
            ></div>
        {/each}
    </div>

    {#if rows.length === 0}
        <p class="px-1 py-1 text-xs text-muted">
            No sequences in this composition.
        </p>
    {:else}
        <div class="mt-1 space-y-1">
            {#each rows as seq (seq.id)}
                <div
                    class="relative h-5 rounded bg-studio"
                    style="margin-left: {seq.depth * 14}px;"
                    title="{seq.id} — {describe(
                        seq.absoluteFrom,
                        seq.durationInFrames,
                    )}"
                >
                    <div
                        class="absolute top-0 bottom-0 rounded bg-accent/50"
                        style="left: {leftPct(
                            seq.absoluteFrom,
                        )}%; width: {widthPct(
                            seq.absoluteFrom,
                            seq.durationInFrames,
                        )}%;"
                    ></div>
                    <span
                        class="absolute top-1/2 left-1 -translate-y-1/2 truncate text-[10px] text-ink"
                    >
                        {seq.id}
                    </span>
                </div>
            {/each}
        </div>
    {/if}

    <div
        class="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-accent"
        style="left: {playhead}%"
    ></div>
</div>
<p class="mt-1 text-xs text-muted">
    {formatDuration(durationInFrames, fps)} total
</p>
