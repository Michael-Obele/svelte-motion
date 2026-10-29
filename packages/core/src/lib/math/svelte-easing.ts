/**
 * Svelte's own easing curves, re-exported.
 *
 * `svelte/easing` is a set of pure `(t: number) => number` functions — no clock,
 * no DOM, no runes — so they satisfy `interpolate`'s `easing` option directly and
 * are exactly the shape `TransitionConfig.easing` expects. They are the one piece
 * of Svelte's built-in motion that a frame-based composition can use unchanged.
 *
 * Provenance: these are Svelte's implementations (MIT, sveltejs/svelte), re-exported
 * rather than copied, so there is nothing here to clean-room (D22) and the upstream
 * licence stays with upstream. Where Svelte has no curve we need — `bezier`, the
 * spring easings, `posterize` — `Easing` in `./easing.ts` remains the source.
 *
 * ```svelte
 * import { interpolate, svelteEasing } from "@svelte-motion/core";
 *
 * const y = $derived(
 *   interpolate(frame, [0, 30], [0, 400], { easing: svelteEasing.bounceOut }),
 * );
 * ```
 */

export * as svelteEasing from "svelte/easing";
