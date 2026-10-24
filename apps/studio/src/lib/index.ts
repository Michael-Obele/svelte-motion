/**
 * Studio-only helpers, importable through the `#lib` alias.
 *
 * The frame runtime lives in `@svelte-motion/core`; this entry point only
 * re-exports the display helpers the Studio chrome (timeline, scrubber)
 * uses, so the module is a real export and not an empty placeholder.
 */
export { clampFrame, formatDuration } from "./format.js";
