/**
 * Svelte config for the studio-ui package.
 *
 * This file exists so tooling that looks for a project root stops here instead of
 * walking up to the repo root and finding a `vite.config.ts` with no Svelte plugin,
 * which reports:
 *
 *   Error: No Svelte configuration found in vite config.
 *   Is @sveltejs/vite-plugin-svelte configured?
 *
 * That error is not about the code: this package is consumed from source, so
 * `svelte-check` (running in an app that imports it) tries to resolve a config for
 * each component it finds. A library package having a `svelte.config.js` is the
 * normal shape, so this is the real fix rather than a stub.
 *
 * There is no preprocessor to configure: the consuming app's Vite setup compiles
 * these components, and `svelte-check` handles `lang="ts"` on its own.
 */
export default {};
