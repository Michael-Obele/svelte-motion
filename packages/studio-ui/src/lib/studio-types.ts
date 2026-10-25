/**
 * Prop types for the Studio library.
 *
 * Named types live here so `vp check` can see them: named exports from
 * `.svelte` files are invisible to `svelte-check`.
 */
import type { CompositionConfig, SequenceEntry } from "@svelte-motion/core";

/** Minimal Player surface the Studio drives through `bind:this`. */
export type PlayerApi = {
  play: () => void;
  pause: () => void;
  seek: (frame: number) => void;
  getSequences?: () => SequenceEntry[];
};

/** Props for `Studio`. */
export type StudioProps = {
  compositions: CompositionConfig[];
  /** Composition shown first. Falls back to the first registered one. */
  initialId?: string;
  /** Called after the user picks a different composition. */
  onselect?: (id: string) => void;
};

/** Props for `Timeline`. */
export type TimelineProps = {
  durationInFrames: number;
  fps: number;
  frame: number;
  sequences: SequenceEntry[];
};

/** Props for `PropsEditor`. Controlled: the parent owns `value`. */
export type PropsEditorProps = {
  composition: CompositionConfig;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
};
