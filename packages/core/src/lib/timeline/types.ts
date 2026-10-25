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

/**
 * Props for `<Sequence>`.
 *
 * Lives here so `vp check` can see it: named exports from `.svelte` modules
 * are invisible to `svelte-check`.
 */
export type SequenceProps = {
  /** Stable label for the timeline registry. Auto-generated when omitted. */
  id?: string;
  from?: number;
  durationInFrames?: number;
  children: Snippet<[{ frame: number }]>;
};

/** Position of a Sequence within its ancestors. */
export type TimelinePosition = {
  depth: number;
  absoluteFrom: number;
};

/**
 * Svelte context key carrying the parent Sequence's position.
 *
 * Runtime value in this module so every `Sequence` instance shares one key.
 */
export const TIMELINE_KEY = Symbol("svelte-motion/timeline");
