<script lang="ts">
    /**
     * Example: quote, staged with `Series` (Tailwind).
     *
     * `Series` shows one item at a time, each for its own duration. A quote works
     * with that if every item renders the lines revealed so far: item one shows
     * one line, item two shows two, and so on. The newest line is bright and the
     * earlier ones sit back, so the reveal reads as progress.
     *
     * Snippets are values and are only in scope in markup, so the item list is
     * written inline below rather than in the script block.
     */
    import {
        AbsoluteFill,
        Series,
        getMotionContext,
        interpolate,
    } from "@svelte-motion/core";
    import type { QuoteSeriesProps } from "./props.js";

    let {
        line1 = "The most dangerous phrase",
        line2 = "in the language is",
        line3 = "we have always done it this way.",
        author = "Grace Hopper",
        role = "Rear Admiral, US Navy",
    }: QuoteSeriesProps = $props();

    const motion = getMotionContext();
    const frame = $derived(motion.frame);

    const clamp = {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    } as const;

    /** The newest line fades in and rises over its first 12 frames. */
    const fadeIn = (local: number): number =>
        interpolate(local, [0, 12], [0, 1], clamp);

    const rise = (local: number): number =>
        interpolate(local, [0, 12], [18, 0], clamp);

    const allLines = $derived([line1, line2, line3]);

    // The attribution arrives once the quote is complete.
    const attribution = $derived(interpolate(frame, [126, 140], [0, 1], clamp));
</script>

{#snippet quote(local: number, count: number)}
    <div class="flex flex-col gap-5">
        {#each allLines.slice(0, count) as text, index (text)}
            {@const newest = index === count - 1}
            <p
                class="text-6xl leading-tight font-medium tracking-tight {newest
                    ? 'text-neutral-100'
                    : 'text-neutral-600'}"
                style={newest
                    ? `opacity: ${fadeIn(local)}; transform: translateY(${rise(local)}px);`
                    : ""}
            >
                {text}
            </p>
        {/each}
    </div>
{/snippet}

{#snippet first({ frame }: { frame: number })}
    {@render quote(frame, 1)}
{/snippet}

{#snippet second({ frame }: { frame: number })}
    {@render quote(frame, 2)}
{/snippet}

{#snippet third({ frame }: { frame: number })}
    {@render quote(frame, 3)}
{/snippet}

<AbsoluteFill class="bg-neutral-950 px-32">
    <div class="flex h-full flex-col justify-center">
        <!--
      Durations sum to 126 of 150 frames, which leaves room for the attribution
      to land. `Series` starts each item at the sum of the durations before it.
    -->
        <Series
            items={[
                { durationInFrames: 42, snippet: first },
                { durationInFrames: 36, snippet: second },
                { durationInFrames: 48, snippet: third },
            ]}
        />

        <div
            class="mt-16 flex items-center gap-5"
            style="opacity: {attribution};"
        >
            <span class="text-3xl font-semibold text-neutral-100">{author}</span
            >
            <span class="h-6 w-px bg-neutral-700"></span>
            <span class="text-2xl text-neutral-400">{role}</span>
        </div>
    </div>
</AbsoluteFill>
