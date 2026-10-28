<script lang="ts">
    /**
     * The player host: one paused frame of one composition through `<Player>`.
     *
     * With the stage at (0,0) and controls below the clip region, a headless browser
     * can screenshot the stage and compare it byte-identically to the `/render` host
     * at the same frame. The M4 parity gate drives this.
     *
     * Every prop is already resolved by the caller. Nothing here touches `$app/*`,
     * which is what lets both `apps/studio` and `examples` serve this surface.
     */
    import { Player, type CompositionConfig } from "@svelte-motion/core";

    let {
        composition,
        compositionId,
        frame,
        inputProps,
        validationError,
        availableIds,
    }: {
        composition: CompositionConfig | undefined;
        compositionId: string;
        frame: number;
        inputProps: Record<string, unknown>;
        validationError?: string;
        /** Ids in registration order, listed when `compositionId` is unknown. */
        availableIds: string[];
    } = $props();

</script>

{#if validationError !== undefined}
    <main class="error">
        <h1>Invalid props</h1>
        <p>Composition <code>{compositionId}</code> props failed validation:</p>
        <p><code>{validationError}</code></p>
    </main>
{:else if composition}
    {@const Component = composition.component}
    <!--
    `Player` reads its config once, so a config change has to remount it. The
    frame is deliberately not in the key: it is driven by `startFrame` and seeks,
    and remounting per frame would break playback.
  -->
    {@const identity = `${composition.id}:${composition.fps}:${composition.width}:${composition.height}:${composition.durationInFrames}`}
    <div class="player-surface">
        {#key identity}
            <Player
                component={Component}
                {inputProps}
                fps={composition.fps}
                width={composition.width}
                height={composition.height}
                durationInFrames={composition.durationInFrames}
                startFrame={frame}
                autoPlay={false}
                loop={false}
                controls={true}
            />
        {/key}
    </div>
{:else}
    <main class="error">
        <h1>Unknown composition</h1>
        <p>
            No composition is registered with the id <code
                >{compositionId === "" ? "(missing)" : compositionId}</code
            >.
        </p>
        <p>Available ids:</p>
        <ul>
            {#each availableIds as id (id)}
                <li><code>{id}</code></li>
            {/each}
        </ul>
    </main>
{/if}

<style>
    /*
     * Colour the controls, never the stage. `/render` has no wrapper, so a stage
     * inheriting a different colour here would change `currentColor` pixels and
     * break parity. `PlayerControls` colours itself from `currentColor`, so the
     * light ink stays on that region only.
     */
    .player-surface :global(.svelte-motion-player-controls) {
        color: var(--color-ink, #e2e8f0);
    }

    .error {
        padding: 32px;
        color: #f8fafc;
        background: #0b1020;
        font-family:
            system-ui,
            -apple-system,
            "Segoe UI",
            Roboto,
            sans-serif;
    }
</style>
