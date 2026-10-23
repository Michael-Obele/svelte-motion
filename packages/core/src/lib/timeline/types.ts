import type { Snippet } from "svelte";

/**
 * One slot in a `<Series>`.
 *
 * Lives in a `.ts` module rather than inside `Series.svelte` because a type
 * exported from a component's script cannot be re-exported through
 * `timeline/index.ts` — the type-aware checker only sees the component's
 * default export.
 */
export type SeriesItem = {
  durationInFrames: number;
  /** Rendered for `durationInFrames` frames, starting where the previous item ended. */
  snippet: Snippet<[{ frame: number }]>;
};
