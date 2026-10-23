/**
 * What the port deliberately does not do yet.
 *
 * `math.test.ts` only contains Remotion assertions the port actually satisfies.
 * This file pins the *other* side: the inputs Remotion supports and we reject.
 * These are throws we DO have — each case runs the call and asserts the error,
 * so "we reject that" cannot rot into a comment nobody executes.
 *
 * Two classes of rejection:
 *   1. Explicit guards for options the port does not implement (`outputType`,
 *      `output`), so the failure names the option instead of silently ignoring
 *      it — which is what the file header promises and what the string parser
 *      alone could not guarantee.
 *   2. Inputs the port cannot represent (CSS Color 4, ragged strings, a
 *      non-function `easing` entry), rejected by the code that would otherwise
 *      produce wrong numbers.
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

describe("outputType / output CSS sugar is rejected by an explicit guard", () => {
  test("outputType: font-weight keywords are not interpolated", () => {
    // Remotion would return 550 here; we will not guess at the mapping.
    expect(() =>
      interpolate(0.5, [0, 1], ["normal", "bold"], {
        // @ts-expect-error — `outputType` is intentionally not in InterpolateOptions
        outputType: "font-weight",
      }),
    ).toThrow(/does not implement the "outputType" option/);
  });

  test("output: perceptual-scale is not interpolated", () => {
    expect(() =>
      interpolate(0.5, [0, 1], [0, 1], {
        // @ts-expect-error — `output` is intentionally not in InterpolateOptions
        output: "perceptual-scale",
      }),
    ).toThrow(/does not implement the "output" option/);
  });

  test("the guard fires before any output is computed, and names the option", () => {
    // A numeric range is legitimate; only the option makes it throw.
    expect(interpolate(0.5, [0, 1], [0, 100])).toBe(50);

    expect(() =>
      interpolate(0.5, [0, 1], [0, 100], {
        // @ts-expect-error — `outputType` is intentionally not in InterpolateOptions
        outputType: "perceptual-scale",
      }),
    ).toThrow(/perceptual-scale and\s+font-weight output are not ported yet/);
  });

  test("transform-origin keywords are not interpolated", () => {
    expect(() => interpolate(0.5, [0, 1], ["left top", "right bottom"])).toThrow(
      /is not a supported scale, translate, or rotate value/,
    );
  });
});

describe("a non-function easing entry is rejected", () => {
  test("easing[1] that is not a function throws and names the index", () => {
    const double = (t: number): number => t * 2;

    expect(() =>
      interpolate(5, [0, 10, 20], [0, 10, 20], {
        // @ts-expect-error — the point of the test: a string is not an easing function
        easing: [double, "not-a-fn"],
      }),
    ).toThrow(/easing\[1\] must be a function/);
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
