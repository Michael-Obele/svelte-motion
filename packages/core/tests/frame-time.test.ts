import { describe, expect, test } from "vite-plus/test";
import { frameAt, frameElapsedMs } from "../src/lib/player/frame-time.js";

describe("frameAt", () => {
  test("0ms → 0", () => {
    expect(frameAt(0, 30, 90, true)).toBe(0);
    expect(frameAt(0, 30, 90, false)).toBe(0);
  });

  test("1000ms @30fps → 30", () => {
    expect(frameAt(1000, 30, 90, true)).toBe(30);
    expect(frameAt(1000, 30, 90, false)).toBe(30);
  });

  test("999.9ms @30fps → 29 (floor)", () => {
    expect(frameAt(999.9, 30, 90, true)).toBe(29);
    expect(frameAt(999.9, 30, 90, false)).toBe(29);
  });

  test("loop wrap: 1000ms @30fps duration 90 → 30, 3000ms → 0", () => {
    expect(frameAt(1000, 30, 90, true)).toBe(30);
    expect(frameAt(3000, 30, 90, true)).toBe(0);
  });

  test("non-loop clamp at duration-1", () => {
    expect(frameAt(3000, 30, 90, false)).toBe(89);
    expect(frameAt(10_000, 30, 90, false)).toBe(89);
  });

  test("negative elapsed → 0", () => {
    expect(frameAt(-1, 30, 90, true)).toBe(0);
    expect(frameAt(-1000, 30, 90, false)).toBe(0);
  });

  test("NaN/Infinity inputs → 0", () => {
    expect(frameAt(NaN, 30, 90, true)).toBe(0);
    expect(frameAt(Infinity, 30, 90, true)).toBe(0);
    expect(frameAt(1000, NaN, 90, true)).toBe(0);
    expect(frameAt(1000, Infinity, 90, true)).toBe(0);
    expect(frameAt(1000, 30, NaN, true)).toBe(0);
    expect(frameAt(1000, 30, Infinity, true)).toBe(0);
  });

  test("fps 0 → 0", () => {
    expect(frameAt(1000, 0, 90, true)).toBe(0);
    expect(frameAt(1000, -1, 90, true)).toBe(0);
  });

  test("duration 0 → 0", () => {
    expect(frameAt(1000, 30, 0, true)).toBe(0);
    expect(frameAt(1000, 30, -5, true)).toBe(0);
  });
});

describe("frameElapsedMs", () => {
  test("round-trip: frame 45 @30fps → 1500ms", () => {
    expect(frameElapsedMs(45, 30)).toBe(1500);
  });

  test("frame 0 → 0", () => {
    expect(frameElapsedMs(0, 30)).toBe(0);
  });

  test("non-finite or fps <=0 → 0", () => {
    expect(frameElapsedMs(NaN, 30)).toBe(0);
    expect(frameElapsedMs(10, 0)).toBe(0);
    expect(frameElapsedMs(10, -1)).toBe(0);
    expect(frameElapsedMs(10, NaN)).toBe(0);
    expect(frameElapsedMs(Infinity, 30)).toBe(0);
  });

  test("frameAt and frameElapsedMs round-trip through floor", () => {
    for (const fps of [24, 30, 60]) {
      for (const frame of [0, 1, 30, 89]) {
        const ms = frameElapsedMs(frame, fps);
        // frameAt floors, so exact frame recovers
        expect(frameAt(ms, fps, 200, false)).toBe(frame);
      }
    }
  });
});
