/**
 * Pure math helpers. No Svelte, no DOM, no runes — safe to import anywhere.
 *
 * The one exception is `svelteEasing`: Svelte's own curves, re-exported rather
 * than copied. They are pure `(t) => number` functions, so they keep this module
 * free of the clock and of runes, and they are the reason the six curves they
 * cover do not need a clean-room implementation (D22).
 *
 * Deterministic: the same inputs always produce the same outputs. The tests in
 * `tests/math.test.ts` pin that down.
 */

export { bezier } from "./bezier.js";
export { Easing, type EasingSpringConfig } from "./easing.js";
export {
  interpolate,
  prepareNumericInterpolation,
  type EasingFunction,
  type ExtrapolateType,
  type InterpolateOptions,
} from "./interpolate.js";
export {
  colorNames,
  interpolateColors,
  processColor,
  type InterpolateColorsOptions,
} from "./interpolate-colors.js";
export { measureSpring, spring, springCalculation, type SpringConfig } from "./spring.js";
export { svelteEasing } from "./svelte-easing.js";
