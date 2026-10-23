<script lang="ts">
  /**
   * Lays children out back to back in time.
   *
   * Svelte cannot read a duration off a snippet, so durations live in data:
   * `items` is an array of `{ durationInFrames, snippet }`. Start frames are
   * cumulative, which is exactly Remotion's `Series.Sequence` behaviour without
   * the manual bookkeeping.
   */
  import Sequence from "./Sequence.svelte";
  import type { SeriesItem } from "./types.js";

  let { items }: { items: SeriesItem[] } = $props();

  const froms = $derived.by(() => {
    const offsets: number[] = [];
    let cursor = 0;

    for (const item of items) {
      if (!Number.isInteger(item.durationInFrames) || item.durationInFrames <= 0) {
        throw new Error(
          `<Series> items need a positive integer durationInFrames, but got ${item.durationInFrames}`,
        );
      }

      offsets.push(cursor);
      cursor += item.durationInFrames;
    }

    return offsets;
  });
</script>

{#each items as item, index (index)}
  <Sequence from={froms[index]} durationInFrames={item.durationInFrames}>
    {#snippet children({ frame })}
      {@render item.snippet({ frame })}
    {/snippet}
  </Sequence>
{/each}
