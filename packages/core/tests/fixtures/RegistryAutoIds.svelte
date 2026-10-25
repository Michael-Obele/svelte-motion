<script lang="ts">
    /** Registry fixture: sibling Sequences without explicit ids. */
    import Sequence from "../../src/lib/timeline/Sequence.svelte";
</script>

<Sequence from={0} durationInFrames={10}>
    {#snippet children({ frame })}
        <span data-a={frame}></span>
    {/snippet}
</Sequence>
<Sequence from={10} durationInFrames={10}>
    {#snippet children({ frame })}
        <span data-b={frame}></span>
    {/snippet}
</Sequence>
