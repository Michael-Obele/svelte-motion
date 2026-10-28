<script lang="ts">
    /**
     * Example: the svelte-motion banner.
     *
     * `assets/banner.svg`, rebuilt as a composition so the landing page can show
     * it moving. One thing animates: the playhead sweeps the timeline and every
     * tick it passes lights up. The sweep runs out and back across the whole
     * clip, so the last frame equals the first and a looped GIF has no seam — an
     * asset that jumps once every three seconds is worse than a still one.
     *
     * It is also the shortest demonstration of a GIF render:
     *
     *     bun packages/cli/src/index.ts render banner \
     *       --out assets/banner.mp4 --build examples/build
     *
     * The type is set in Inter with a system-ui fallback, the same stack the SVG
     * asks for, so a machine without Inter falls back exactly as the artwork
     * already does.
     */
    import { untrack } from "svelte";
    import {
        AbsoluteFill,
        Easing,
        getMotionContext,
        interpolate,
    } from "@svelte-motion/core";

    const motion = getMotionContext();
    const frame = $derived(motion.frame);
    const durationInFrames = untrack(() => motion.durationInFrames);

    /** Geometry, read off the artwork so the composition and the SVG cannot drift. */
    const TRACK_START = 860;
    const TRACK_WIDTH = 340;
    const TICK_COUNT = 12;
    /** Where the playhead sits at rest in the SVG, and how far it travels. */
    const PLAYHEAD_REST = 962;
    const MARK_HEAD_REST = 51;
    const MARK_HEAD_TRAVEL = 18;

    const TICKS = Array.from({ length: TICK_COUNT }, (_, index) => ({
        x: TRACK_START + (index * TRACK_WIDTH) / (TICK_COUNT - 1),
        // Every fourth tick is a beat marker and stands taller, as in the SVG.
        length: index % 4 === 0 ? 6 : 2,
    }));

    const clamp = {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
    } as const;
    const ease = Easing.inOut(Easing.cubic);
    const halfway = durationInFrames / 2;

    /*
     * There and back again. Eased on both legs so the playhead slows into the
     * turn instead of bouncing off the end like a reflection; `clamp` keeps a
     * frame that lands past the midpoint from extrapolating into negatives.
     */
    const progress = $derived(
        frame <= halfway
            ? interpolate(frame, [0, halfway], [0, 1], {
                  easing: ease,
                  ...clamp,
              })
            : interpolate(frame, [halfway, durationInFrames], [1, 0], {
                  easing: ease,
                  ...clamp,
              }),
    );

    const playheadX = $derived(TRACK_START + progress * TRACK_WIDTH);
    const markHeadX = $derived(
        MARK_HEAD_REST - MARK_HEAD_TRAVEL / 2 + progress * MARK_HEAD_TRAVEL,
    );
</script>

<AbsoluteFill style="background: #0b1020;">
    <svg
        class="banner"
        viewBox="0 0 1280 400"
        role="img"
        aria-label="svelte-motion — videos as Svelte components"
    >
        <rect x="0" y="0" width="1280" height="400" rx="16" fill="#0b1020" />
        <rect
            x="1"
            y="1"
            width="1278"
            height="398"
            rx="16"
            fill="none"
            stroke="#1f2937"
        />

        <g transform="translate(80,152)">
            <rect
                x="0"
                y="0"
                width="96"
                height="96"
                rx="21"
                fill="#111827"
                stroke="#1f2937"
            />
            <rect x="21" y="36" width="54" height="9" rx="4.5" fill="#94a3b8" />
            <rect x="21" y="54" width="36" height="9" rx="4.5" fill="#4b5563" />
            <!-- The mark is a timeline, so its playhead moves like one too. -->
            <g transform="translate({markHeadX - MARK_HEAD_REST}, 0)">
                <rect x="51" y="21" width="6" height="48" fill="#6366f1" />
                <polygon points="45,21 63,21 54,33" fill="#6366f1" />
            </g>
        </g>

        <!-- `&#160;` rather than a literal space: whitespace at the start of a
             tspan is collapsed, which silently welds the two words together. -->
        <text class="wordmark" x="200" y="224"
            >svelte<tspan fill="#6366f1">&#160;motion</tspan></text
        >
        <text class="tagline" x="204" y="274">Videos as Svelte components</text>

        <g stroke="#2f3a4d">
            <line
                x1={TRACK_START}
                y1="200"
                x2={TRACK_START + TRACK_WIDTH}
                y2="200"
            />
            {#each TICKS as tick (tick.x)}
                <line
                    x1={tick.x}
                    y1="200"
                    x2={tick.x}
                    y2={200 + tick.length}
                    stroke={tick.x <= playheadX ? "#6366f1" : "#2f3a4d"}
                />
            {/each}
        </g>

        <g transform="translate({playheadX - PLAYHEAD_REST}, 0)">
            <rect x="962" y="168" width="2" height="64" fill="#6366f1" />
            <polygon points="959,168 967,168 963,176" fill="#6366f1" />
        </g>
    </svg>
</AbsoluteFill>

<style>
    .banner {
        display: block;
        width: 100%;
        height: 100%;
    }

    .wordmark,
    .tagline {
        font-family:
            Inter,
            system-ui,
            -apple-system,
            "Segoe UI",
            Roboto,
            sans-serif;
    }

    .wordmark {
        font-size: 92px;
        font-weight: 700;
        letter-spacing: -2.5px;
        fill: #f8fafc;
    }

    .tagline {
        font-size: 32px;
        font-weight: 400;
        letter-spacing: 0.6px;
        fill: #94a3b8;
    }
</style>
