<script lang="ts">
    /**
     * Registry fixture: nested Sequences without a root.
     *
     * Mounted inside `Player` (which owns the root context) so tests can read
     * the registry through the Player's `getSequences()`.
     */
    import Sequence from "../../src/lib/timeline/Sequence.svelte";
</script>

<Sequence from={30} durationInFrames={60} id="outer">
    {#snippet children({ frame })}
        <span data-frame={frame}></span>
        <Sequence from={10} durationInFrames={20} id="inner">
            {#snippet children({ frame: inner })}
                <span data-inner-frame={inner}></span>
            {/snippet}
        </Sequence>
    {/snippet}
</Sequence>
