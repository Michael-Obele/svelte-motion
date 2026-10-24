/**
 * Props for the title-card composition.
 *
 * Lives here (not in the `.svelte` file) because `svelte-check` cannot see
 * named exports from `.svelte` modules.
 */
export type TitleCardProps = {
  title?: string;
  subtitle?: string;
};
