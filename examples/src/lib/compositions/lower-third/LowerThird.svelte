<script lang="ts">
    /**
     * Example: lower third.
     *
     * A name and role slide in from the left, hold, and slide back out. The
     * whole graphic lives inside one `Sequence`, so the local frame starts at
     * zero when the graphic enters and the exit timing is written relative to
     * that, not to the composition's absolute frame numbers.
     */
    import { untrack } from "svelte";
    import {
        AbsoluteFill,
        Sequence,
        getMotionContext,
        interpolate,
        spring,
    } from "@svelte-motion/core";
    import type { LowerThirdProps } from "./props.js";

    let {
        name = "Ada Lovelace",
        role = "Composer of algorithms",
    }: LowerThirdProps = $props();

    const motion = getMotionContext();
    const fps = untrack(() => motion.fps);

    const clamp = {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    } as const;
</script>

<AbsoluteFill style="background: #0b1020;">
    <Sequence from={10} durationInFrames={110}>
        {#snippet children({ frame })}
            {@const entry = spring({ frame, fps, config: { damping: 200 } })}
            {@const exit = interpolate(frame, [86, 110], [0, 1], clamp)}
            {@const x =
                interpolate(entry, [0, 1], [-720, 0], clamp) + exit * -720}
            {@const opacity = 1 - exit}

            <div
                class="wrap"
                style="transform: translateX({x}px); opacity: {opacity};"
            >
                <div class="panel">
                    <span class="accent"></span>
                    <div class="text">
                        <span class="name">{name}</span>
                        <span class="role">{role}</span>
                    </div>
                </div>
            </div>
        {/snippet}
    </Sequence>
</AbsoluteFill>

<style>
    .wrap {
        position: absolute;
        left: 96px;
        bottom: 96px;
    }

    .panel {
        display: flex;
        align-items: stretch;
        gap: 24px;
        padding: 24px 32px 24px 0;
        background: #111827;
        border: 1px solid #1f2937;
        border-radius: 6px;
        box-shadow: 0 12px 32px rgb(0 0 0 / 0.28);
    }

    .accent {
        width: 6px;
        background: #6366f1;
        border-radius: 0 2px 2px 0;
    }

    .text {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-left: 28px;
    }

    .name {
        color: #f8fafc;
        font-family:
            system-ui,
            -apple-system,
            "Segoe UI",
            Roboto,
            sans-serif;
        font-size: 46px;
        font-weight: 600;
        letter-spacing: -0.01em;
        line-height: 1.1;
    }

    .role {
        color: #94a3b8;
        font-family:
            system-ui,
            -apple-system,
            "Segoe UI",
            Roboto,
            sans-serif;
        font-size: 26px;
        font-weight: 400;
        letter-spacing: 0.02em;
    }
</style>
