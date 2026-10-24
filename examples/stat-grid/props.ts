/**
 * Props for the stat-grid composition.
 *
 * Lives here (not in the `.svelte` file) because `svelte-check` cannot see
 * named exports from `.svelte` modules.
 */
export type StatGridProps = {
  heading?: string;
};
