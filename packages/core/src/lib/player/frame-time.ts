/**
 * Pure frame-time helpers. No Svelte, no DOM, deterministic.
 *
 * `frameAt` maps wall-clock elapsed time to a frame number at a given fps.
 * `frameElapsedMs` is its inverse, used to rebase after a seek.
 */

/**
 * Maps elapsed wall-clock time to a frame.
 *
 * Rules (from the brief):
 * - `Math.floor(elapsedMs * fps / 1000)`
 * - elapsed < 0 → 0
 * - loop → modulo duration
 * - no loop → clamp to duration-1
 * - non-finite inputs → 0
 * - fps <= 0 → 0
 */
export const frameAt = (
  elapsedMs: number,
  fps: number,
  durationInFrames: number,
  loop: boolean,
): number => {
  if (!Number.isFinite(elapsedMs) || !Number.isFinite(fps) || !Number.isFinite(durationInFrames)) {
    return 0;
  }

  if (fps <= 0 || durationInFrames <= 0) {
    return 0;
  }

  if (elapsedMs < 0) {
    return 0;
  }

  const raw = Math.floor((elapsedMs * fps) / 1000);

  if (loop) {
    return raw % durationInFrames;
  }

  return Math.min(raw, durationInFrames - 1);
};

/**
 * Inverse of `frameAt` without the floor: how many ms a frame represents.
 *
 * Used to rebase `origin` after a seek so resuming does not jump back.
 */
export const frameElapsedMs = (frame: number, fps: number): number => {
  if (!Number.isFinite(frame) || !Number.isFinite(fps) || fps <= 0) {
    return 0;
  }

  return (frame / fps) * 1000;
};

/**
 * The single frame-range policy for the whole engine: a frame is valid in
 * `[0, durationInFrames - 1]`. A `durationInFrames` of N means N frames indexed
 * 0..N-1, so frame N is out of range and clamps to N-1.
 *
 * Every entry point that accepts a frame from outside — the host query parser,
 * the Player, `MotionRoot.initialFrame`, the Studio scrubber — must go through
 * this one function so the surfaces can never disagree about the boundary.
 * Non-finite input becomes frame 0.
 */
export const clampFrame = (frame: number, durationInFrames: number): number => {
  if (!Number.isFinite(frame) || !Number.isFinite(durationInFrames)) {
    return 0;
  }

  const max = Math.max(0, Math.floor(durationInFrames) - 1);

  return Math.max(0, Math.min(Math.floor(frame), max));
};
