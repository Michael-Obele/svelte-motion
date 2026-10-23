/**
 * Pure math helpers. No Svelte, no DOM, no runes — safe to import anywhere.
 *
 * These produce the same numbers as Remotion 4.0.538 for the same inputs. The
 * parity tests in `tests/math.test.ts` pin that down.
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
