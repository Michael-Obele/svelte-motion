/**
 * Props for the lower-third composition.
 *
 * Lives here (not in the `.svelte` file) because `svelte-check` cannot see
 * named exports from `.svelte` modules.
 */
export type LowerThirdProps = {
  name?: string;
  role?: string;
};
