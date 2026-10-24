/**
 * Chunking is arithmetic, so it is tested as arithmetic.
 *
 * Every assertion here protects one property the frame loop relies on: the
 * ranges tile the composition exactly. A gap drops frames from the MP4, an
 * overlap encodes a frame twice and shifts everything after it, and an empty
 * range opens a browser to do nothing.
 */

import { describe, expect, test } from "vite-plus/test";
import { chunkRange } from "../src/index.ts";

/** Contiguity, coverage and non-emptiness in one predicate. */
const tiles = (ranges: readonly { start: number; end: number }[], start: number, end: number) => {
  if (ranges.length === 0) {
    return start === end;
  }

  const first = ranges[0];
  const last = ranges.at(-1);

  if (first === undefined || last === undefined || first.start !== start || last.end !== end) {
    return false;
  }

  return ranges.every((range, index) => {
    const next = ranges[index + 1];

    // No empty range, ever.
    if (range.end <= range.start) {
      return false;
    }

    // The next range picks up exactly where this one stopped.
    return next === undefined || next.start === range.end;
  });
};

describe("chunkRange", () => {
  test("concurrency 1 yields the whole composition as one range", () => {
    expect(chunkRange(0, 90, 1)).toEqual([{ start: 0, end: 90 }]);
  });

  test("concurrency 4 over 90 frames tiles the input", () => {
    const ranges = chunkRange(0, 90, 4);

    expect(ranges).toHaveLength(4);
    expect(tiles(ranges, 0, 90)).toBe(true);
    expect(ranges.reduce((sum, range) => sum + (range.end - range.start), 0)).toBe(90);
    // Balanced, not "one big chunk and three small ones": at most one frame apart.
    const sizes = ranges.map((range) => range.end - range.start);

    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  test("concurrency 200 over 90 frames is clamped to 90 single-frame ranges", () => {
    const ranges = chunkRange(0, 90, 200);

    expect(ranges).toHaveLength(90);
    expect(tiles(ranges, 0, 90)).toBe(true);
    expect(ranges.every((range) => range.end - range.start === 1)).toBe(true);
    expect(ranges[0]).toEqual({ start: 0, end: 1 });
    expect(ranges.at(-1)).toEqual({ start: 89, end: 90 });
  });

  test("an empty range yields no chunks", () => {
    expect(chunkRange(0, 0, 4)).toEqual([]);
    // Inverted input is empty too, not a negative-length range.
    expect(chunkRange(10, 5, 4)).toEqual([]);
  });

  test("ranges start at an offset and stay contiguous", () => {
    const ranges = chunkRange(30, 90, 3);

    expect(tiles(ranges, 30, 90)).toBe(true);
    expect(ranges[0]?.start).toBe(30);
    expect(ranges.at(-1)?.end).toBe(90);
  });

  test("an unusable concurrency falls back to 1 instead of dropping frames", () => {
    expect(chunkRange(0, 90, 0)).toEqual([{ start: 0, end: 90 }]);
    expect(chunkRange(0, 90, Number.NaN)).toEqual([{ start: 0, end: 90 }]);
    expect(chunkRange(0, 90, Number.POSITIVE_INFINITY)).toEqual([{ start: 0, end: 90 }]);
  });
});
