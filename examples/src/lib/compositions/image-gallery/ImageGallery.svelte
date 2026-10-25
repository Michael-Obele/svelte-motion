<script lang="ts">
    /**
     * Example: image gallery.
     *
     * Three images cross-fade, each one slowly scaling up while it is on screen.
     * `prefetch` warms the images before the first frame is captured, so the
     * renderer never screenshots a half-loaded image.
     */
    import { onMount } from "svelte";
    import {
        AbsoluteFill,
        Img,
        getMotionContext,
        interpolate,
        prefetch,
    } from "@svelte-motion/core";

    const motion = getMotionContext();
    const frame = $derived(motion.frame);

    const panels = [
        "examples/gallery-1.svg",
        "examples/gallery-2.svg",
        "examples/gallery-3.svg",
    ] as const;

    const PER_PANEL = 40;
    const FADE = 8;

    const clamp = {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    } as const;

    /** Visible only inside its own 40-frame slot, with a short cross-fade. */
    const opacityAt = (index: number, at: number): number => {
        const start = index * PER_PANEL;
        const end = start + PER_PANEL;

        const fadeIn =
            index === 0
                ? 1
                : interpolate(at, [start, start + FADE], [0, 1], clamp);
        const fadeOut =
            index === panels.length - 1
                ? 1
                : interpolate(at, [end - FADE, end], [1, 0], clamp);

        return Math.min(fadeIn, fadeOut);
    };

    const scaleAt = (index: number, at: number): number =>
        interpolate(
            at,
            [index * PER_PANEL, (index + 1) * PER_PANEL],
            [1, 1.06],
            clamp,
        );

    const activeIndex = $derived(
        Math.min(panels.length - 1, Math.floor(frame / PER_PANEL)),
    );

    onMount(() => {
        const cleanups = panels.map((panel) => prefetch(panel));

        return () => {
            for (const cleanup of cleanups) {
                cleanup();
            }
        };
    });
</script>

<AbsoluteFill
    style="background: #070b14; align-items: center; justify-content: center;"
>
    <div class="stage">
        {#each panels as panel, index (panel)}
            <div
                class="panel"
                style="opacity: {opacityAt(
                    index,
                    frame,
                )}; transform: scale({scaleAt(index, frame)});"
            >
                <Img src={panel} alt="" style="width: 100%; height: 100%;" />
            </div>
        {/each}

        <span class="counter">{activeIndex + 1} / {panels.length}</span>
    </div>
</AbsoluteFill>

<style>
    .stage {
        position: relative;
        width: 1200px;
        height: 675px;
        overflow: hidden;
        border-radius: 12px;
        background: #131a2e;
    }

    .panel {
        position: absolute;
        inset: 0;
    }

    .counter {
        position: absolute;
        right: 24px;
        bottom: 20px;
        color: #e2e8f0;
        font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
        font-size: 22px;
        letter-spacing: 0.08em;
        opacity: 0.85;
    }
</style>
