/**
 * Props for the loop-ticker composition.
 *
 * Lives here (not in the `.svelte` file) because `svelte-check` cannot see
 * named exports from `.svelte` modules.
 */
export type LoopTickerProps = {
  heading?: string;
  items?: string[];
};
