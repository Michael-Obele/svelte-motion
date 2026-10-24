/**
 * Frame-range chunking.
 *
 * Parallel capture is only honest if the frames stay addressable: every worker
 * writes into a slot indexed by the *absolute* frame number, and the encoder
 * replays the result in ascending order. That is why chunks carry absolute
 * indices instead of a local `0..n` cursor — a chunk that finishes first must
 * still land at frame 40, not at frame 0.
 *
 * The split is balanced by distributing the remainder over the first chunks
 * rather than by rounding, so the ranges always tile the input exactly. `D9` in
 * `plan/decisions.md` says the encoder sees frames in order; this module is the
 * other half of that promise.
 */

/** A half-open `[start, end)` range of absolute frame numbers. */
export type FrameRange = {
  /** First frame of the range, inclusive. */
  start: number;
  /** One past the last frame of the range. */
  end: number;
};

/**
 * Splits `[start, end)` into contiguous, non-overlapping ranges.
 *
 * Guarantees:
 *
 * - the ranges are contiguous and cover the input exactly — `start` of the first
 *   equals `start`, `end` of the last equals `end`, and no gap or overlap exists
 *   between neighbours;
 * - no range is empty, so a worker never opens a browser to render nothing;
 * - the range count is clamped to the frame count, because asking for 200 chunks
 *   of a 90-frame composition cannot produce 200 non-empty ranges.
 *
 * An empty or inverted range yields `[]`. A `concurrency` that is not a finite
 * number `>= 1` is treated as `1`: a bad hint must not silently drop frames.
 *
 * @param start - First frame number, inclusive
 * @param end - One past the last frame number
 * @param concurrency - How many ranges to aim for
 * @returns Ranges in ascending frame order
 */
export const chunkRange = (start: number, end: number, concurrency: number): FrameRange[] => {
  const total = end - start;

  if (!Number.isFinite(total) || total <= 0) {
    return [];
  }

  const requested = Number.isFinite(concurrency) && concurrency >= 1 ? Math.floor(concurrency) : 1;
  const count = Math.min(requested, total);
  const size = Math.floor(total / count);
  const remainder = total % count;

  const ranges: FrameRange[] = [];
  let cursor = start;

  for (let index = 0; index < count; index += 1) {
    // The first `remainder` ranges take one extra frame, which is what keeps the
    // total exact for inputs that do not divide evenly.
    const rangeEnd = cursor + size + (index < remainder ? 1 : 0);

    ranges.push({ start: cursor, end: rangeEnd });
    cursor = rangeEnd;
  }

  return ranges;
};
