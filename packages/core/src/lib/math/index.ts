/**
 * Pure math helpers. No Svelte, no DOM, no runes — safe to import anywhere.
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
