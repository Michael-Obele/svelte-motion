/**
 * Props for the quote-series composition.
 *
 * Lives here (not in the `.svelte` file) because `svelte-check` cannot see
 * named exports from `.svelte` modules.
 */
export type QuoteSeriesProps = {
  line1?: string;
  line2?: string;
  line3?: string;
  author?: string;
  role?: string;
};
