/**
 * Studio-only display helpers for the timeline and scrubber.
 *
 * Pure functions over frame counts — no motion state, no DOM. The frame
 * runtime lives in `@svelte-motion/core`; this file only formats what the
 * Studio chrome shows around it.
 */

/**
 * Total-duration label, e.g. `formatDuration(90, 30) === "3.00s"`.
 *
 * Anything unusable (non-finite input, non-positive fps) renders as zero
 * rather than `NaN`, so a broken config shows a calm label, not a crash.
 */
export const formatDuration = (frames: number, fps: number): string => {
  if (!Number.isFinite(frames) || !Number.isFinite(fps) || fps <= 0) {
    return "0.00s";
  }

  return `${(Math.max(0, frames) / fps).toFixed(2)}s`;
};

/**
 * Clamp a frame into `[0, durationInFrames - 1]`.
 *
 * Delegates to the one policy in `@svelte-motion/core` so this app cannot drift
 * from the Player, `MotionRoot` or the host query parser. Non-finite input
 * becomes frame 0.
 */
export { clampFrame } from "@svelte-motion/core";
