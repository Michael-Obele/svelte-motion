<script lang="ts">
    /**
     * Example: stat grid (Tailwind).
     *
     * Four cards rise in one after another and their numbers count up. Layout,
     * spacing, colour and type all come from Tailwind utilities; only the
     * animated values (opacity, translate, the count) are inline styles, because
     * those change per frame and Tailwind compiles a fixed class list.
     */
    import { untrack } from "svelte";
    import {
        AbsoluteFill,
        getMotionContext,
        interpolate,
        spring,
    } from "@svelte-motion/core";
    import type { StatGridProps } from "./props.js";

    let { heading = "This quarter" }: StatGridProps = $props();

    const motion = getMotionContext();
    const frame = $derived(motion.frame);
    const fps = untrack(() => motion.fps);

    const clamp = {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    } as const;

    type Stat = { label: string; value: number; delta: string; up: boolean };

    const stats: Stat[] = [
        { label: "Renders", value: 1842, delta: "+12%", up: true },
        { label: "Projects", value: 37, delta: "+4", up: true },
        { label: "Avg. frame", value: 84, delta: "-9ms", up: true },
        { label: "Errors", value: 3, delta: "-2", up: true },
    ];

    const entryAt = (index: number): number =>
        spring({
            frame: frame - (6 + index * 5),
            fps,
            config: { damping: 200 },
        });

    const countAt = (stat: Stat, index: number): string =>
        Math.round(
            interpolate(entryAt(index), [0, 1], [0, stat.value], clamp),
        ).toLocaleString("en-US");

    const offsetAt = (index: number): number =>
        interpolate(entryAt(index), [0, 1], [28, 0], clamp);
</script>

<AbsoluteFill class="bg-neutral-950 p-24">
    <div class="flex h-full flex-col justify-center gap-16">
        <header class="flex items-baseline justify-between">
            <h1 class="text-6xl font-semibold tracking-tight text-neutral-50">
                {heading}
            </h1>
            <span class="text-2xl font-medium tracking-widest text-indigo-400">
                LIVE
            </span>
        </header>

        <div class="grid grid-cols-4 gap-8">
            {#each stats as stat, index (stat.label)}
                {@const entry = entryAt(index)}
                <div
                    class="rounded-lg border border-neutral-800 bg-neutral-900 p-8"
                    style="opacity: {entry}; transform: translateY({offsetAt(
                        index,
                    )}px);"
                >
                    <p
                        class="text-xl font-medium uppercase tracking-wider text-neutral-400"
                    >
                        {stat.label}
                    </p>
                    <p
                        class="mt-4 font-mono text-6xl font-semibold tabular-nums text-neutral-50"
                    >
                        {countAt(stat, index)}
                    </p>
                    <p class="mt-3 text-xl font-medium text-indigo-400">
                        {stat.delta}
                    </p>
                </div>
            {/each}
        </div>
    </div>
</AbsoluteFill>
