/**
 * What the port deliberately does not do yet.
 *
 * `math.test.ts` only contains Remotion assertions the port actually satisfies.
 * This file pins the *other* side: the inputs Remotion supports and we reject.
 * Without it, "we reject that" is a comment nobody runs, and a silent
 * half-implementation could ship.
 *
 * Every case below throws a message that tells the author what to do instead.
 */

import { describe, expect, test } from "vite-plus/test";
import { interpolate } from "../src/lib/math/interpolate.js";
import { interpolateColors } from "../src/lib/math/interpolate-colors.js";

describe("CSS Color 4 spaces are rejected, not guessed", () => {
  for (const color of [
    "oklch(0 0 0)",
    "oklab(0 0 0)",
    "lab(0 0 0)",
    "lch(0 0 0)",
    "hwb(0 0% 0%)",
  ]) {
    test(color, () => {
      expect(() => interpolateColors(1, [0, 1], ["black", color])).toThrow(
        /uses a CSS Color 4 space that Svelte Motion does not support yet/,
      );
    });
  }
});

describe("outputType CSS sugar is rejected", () => {
  test("font-weight keywords are not interpolated", () => {
    // Remotion would return 550 here; we will not guess at the mapping.
    expect(() =>
      interpolate(0.5, [0, 1], ["normal", "bold"], {
        // @ts-expect-error — `outputType` is intentionally not in InterpolateOptions
        outputType: "font-weight",
      }),
    ).toThrow(/is not a supported scale, translate, or rotate value/);
  });

  test("transform-origin keywords are not interpolated", () => {
    expect(() => interpolate(0.5, [0, 1], ["left top", "right bottom"])).toThrow(
      /is not a supported scale, translate, or rotate value/,
    );
  });
});

describe("ragged multi-component strings are rejected", () => {
  test("a 1-component range cannot mix with a 2-component one", () => {
    // Remotion pads the shorter one; we require the author to be explicit.
    expect(() => interpolate(15, [0, 30], ["0px", "100px 50%"])).toThrow(
      /string values with 1 and 2 components/,
    );
  });
});
