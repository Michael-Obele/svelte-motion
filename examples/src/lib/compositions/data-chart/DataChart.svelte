<script lang="ts">
    /**
     * Example: data chart.
     *
     * The numbers come from a JSON file fetched at render time. A `delayRender`
     * handle holds the renderer until the fetch resolves, which is the whole
     * point: without it the first frame would be captured with an empty chart.
     * Bars grow with staggered springs and the labels count up with the same
     * progress value.
     */
    import { onMount, untrack } from "svelte";
    import {
        AbsoluteFill,
        continueRender,
        delayRender,
        getMotionContext,
        interpolate,
        spring,
        staticFile,
    } from "@svelte-motion/core";
    import type { DataChartProps } from "./props.js";

    type Row = { label: string; value: number };
    type ChartData = { heading?: string; rows: Row[] };

    let { heading = "Monthly renders" }: DataChartProps = $props();

    const motion = getMotionContext();
    const frame = $derived(motion.frame);
    const fps = untrack(() => motion.fps);

    let data = $state<ChartData | null>(null);
    const handle = delayRender("data-chart: fetch chart-data.json");

    onMount(async () => {
        try {
            const response = await fetch(
                staticFile("examples/chart-data.json"),
            );
            data = (await response.json()) as ChartData;
        } finally {
            continueRender(handle);
        }
    });

    const clamp = {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    } as const;

    const MAX_BAR = 940;
    const rows = $derived(data?.rows ?? []);
    const maxValue = $derived(
        rows.reduce((largest, row) => Math.max(largest, row.value), 1),
    );

    const barWidth = (row: Row, index: number): number => {
        const entry = spring({
            frame: frame - (8 + index * 6),
            fps,
            config: { damping: 200 },
        });

        return interpolate(
            entry,
            [0, 1],
            [0, (row.value / maxValue) * MAX_BAR],
            clamp,
        );
    };

    const countedValue = (row: Row, index: number): number => {
        const entry = spring({
            frame: frame - (8 + index * 6),
            fps,
            config: { damping: 200 },
        });

        return Math.round(interpolate(entry, [0, 1], [0, row.value], clamp));
    };
</script>

<AbsoluteFill
    style="background: #0b1020; padding: 96px; justify-content: center;"
>
    <div class="chart">
        <h1 class="heading">{heading}</h1>

        {#each rows as row, index (row.label)}
            <div class="row">
                <span class="label">{row.label}</span>
                <div class="track">
                    <div
                        class="bar"
                        style="width: {barWidth(row, index)}px;"
                    ></div>
                    <span class="value">{countedValue(row, index)}</span>
                </div>
            </div>
        {/each}
    </div>
</AbsoluteFill>

<style>
    .chart {
        display: flex;
        flex-direction: column;
        gap: 30px;
        width: 100%;
    }

    .heading {
        margin: 0 0 28px;
        color: #f8fafc;
        font-family:
            system-ui,
            -apple-system,
            "Segoe UI",
            Roboto,
            sans-serif;
        font-size: 58px;
        font-weight: 700;
        letter-spacing: -0.02em;
    }

    .row {
        display: flex;
        align-items: center;
        gap: 32px;
    }

    .label {
        width: 220px;
        color: #94a3b8;
        font-family:
            system-ui,
            -apple-system,
            "Segoe UI",
            Roboto,
            sans-serif;
        font-size: 26px;
        text-align: right;
        letter-spacing: 0.01em;
    }

    .track {
        display: flex;
        align-items: center;
        gap: 20px;
        height: 64px;
    }

    .bar {
        height: 64px;
        background: #6366f1;
        border-radius: 3px;
    }

    .value {
        color: #e2e8f0;
        font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
        font-size: 26px;
        font-variant-numeric: tabular-nums;
    }
</style>
