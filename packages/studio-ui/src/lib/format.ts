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
 * Mirrors the Player's own clamp so the scrubber can never ask for a frame
 * the Player would reject. Non-finite input becomes frame 0.
 */
export const clampFrame = (frame: number, durationInFrames: number): number => {
  if (!Number.isFinite(frame)) {
    return 0;
  }

  const max = Math.max(0, durationInFrames - 1);

  return Math.max(0, Math.min(frame, max));
};
