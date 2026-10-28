/**
 * `@svelte-motion/core` — the public surface.
 *
 * Three layers, in dependency order:
 *
 * - `math` — pure TypeScript, no Svelte, no DOM. Frame-to-value mapping.
 * - `motion` — the frame runtime: context, composition registry, readiness.
 * - `timeline` — the components that narrow the frame their children see.
 *
 * Everything here is browser-only. Node built-ins belong in
 * `@svelte-motion/renderer`, which consumes this package.
 */

/* -------------------------------------------------------------------------- */
/* Math                                                                        */
/* -------------------------------------------------------------------------- */

// Mirrors `math/index.ts` exactly; that file is the curated list.
export * from "./math/index.js";

/* -------------------------------------------------------------------------- */
/* Motion runtime                                                              */
/* -------------------------------------------------------------------------- */

export {
  DerivedMotionContext,
  MotionContext,
  getMotionContext,
  setMotionContext,
  useCurrentFrame,
  useVideoConfig,
  type MotionState,
  type SequenceEntry,
  type VideoConfig,
} from "./motion/context.svelte.js";

export { default as MotionRoot } from "./motion/MotionRoot.svelte";
export { default as Stage } from "./motion/Stage.svelte";

export {
  clearCompositions,
  collectCompositions,
  defineComposition,
  getComposition,
  getCompositions,
  type CompositionConfig,
} from "./motion/composition.js";

export {
  continueRender,
  delayRender,
  getPendingLabels,
  installReadinessGlobal,
  isReady,
  resetReadiness,
  waitForReady,
} from "./motion/ready.js";

export {
  getSvelteMotionEnvironment,
  setSvelteMotionEnvironmentFlag,
  type SvelteMotionEnvironment,
} from "./motion/env.js";

export { prefetch, staticFile } from "./motion/asset.js";

/* -------------------------------------------------------------------------- */
/* Timeline                                                                    */
/* -------------------------------------------------------------------------- */

export * from "./timeline/index.js";

/* -------------------------------------------------------------------------- */
/* Player                                                                     */
/* -------------------------------------------------------------------------- */

export { default as Player } from "./player/Player.svelte";
export { default as PlayerControls } from "./player/PlayerControls.svelte";
export { frameAt, frameElapsedMs, clampFrame } from "./player/frame-time.js";
export type { PlayerControlsProps, PlayerProps } from "./player/types.js";
