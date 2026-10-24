/**
 * Svelte project config for the examples folder.
 *
 * The examples are compositions, not an app: they are compiled by whichever host
 * imports them (`apps/studio` today). This file exists so tooling that looks for
 * a project root stops here instead of walking up to the repo root and finding a
 * `vite.config.ts` with no Svelte plugin, which is what produced:
 *
 *   Error: No Svelte configuration found in vite config.
 *   Is @sveltejs/vite-plugin-svelte configured?
 *
 * `svelte-check` handles `lang="ts"` on its own, so no preprocessor is needed.
 */
export default {};
