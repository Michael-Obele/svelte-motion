/**
 * Props for the data-chart composition.
 *
 * Lives here (not in the `.svelte` file) because `svelte-check` cannot see
 * named exports from `.svelte` modules.
 */
export type DataChartProps = {
  heading?: string;
};
