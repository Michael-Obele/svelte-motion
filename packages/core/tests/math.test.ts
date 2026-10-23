/**
 * Remotion parity: math.
 *
 * Every expected value in this file is copied from Remotion 4.0.538's own test
 * suite (`packages/core/src/test/{interpolate,interpolateColors,easing,bezier,
 * measure-spring}.test.ts`). They are NOT recomputed from our implementation —
 * that is the whole point. If a number here changes, the port drifted.
 *
 * Deliberately absent, because `packages/core` does not implement them yet
 * (they throw a clear error rather than guessing):
 *   - `output` / `outputType` CSS sugar (`font-weight`, `transform-origin`,
 *     axis rotations, `perceptual-scale`)
 *   - non-numeric string hold mode (`Easing.step1` cursors)
 *   - CSS Color 4 spaces (`oklch`, `oklab`, `lab`, `lch`, `hwb`)
 *   - ragged multi-component strings (`['0px', '100px 50%']`), which Remotion
 *     pads and we reject
 * `tests/parity-exclusions.test.ts` pins the throws we do have, including
 * `outputType`/`output` and a non-function `easing[i]`.
 */

import { describe, expect, test } from "vite-plus/test";
import { bezier } from "../src/lib/math/bezier.js";
import { Easing } from "../src/lib/math/easing.js";
import { interpolate } from "../src/lib/math/interpolate.js";
import { interpolateColors } from "../src/lib/math/interpolate-colors.js";
import { measureSpring, spring } from "../src/lib/math/spring.js";

/**
 * `Easing`'s curves are static methods. Passing one as a value reads as an
 * "unbound method" to the linter, which cannot know they never touch `this`.
 * These thin wrappers keep the parity tests readable and the reference safe.
 */
const curve = {
  step0: (n: number): number => Easing.step0(n),
  step1: (n: number): number => Easing.step1(n),
  linear: (n: number): number => Easing.linear(n),
  quad: (n: number): number => Easing.quad(n),
  cubic: (n: number): number => Easing.cubic(n),
  sin: (n: number): number => Easing.sin(n),
  circle: (n: number): number => Easing.circle(n),
  exp: (n: number): number => Easing.exp(n),
  bounce: (n: number): number => Easing.bounce(n),
};

/** Minimal stand-in for Remotion's `expect-to-throw` helper. */
const expectToThrow = (fn: () => unknown, matcher: RegExp | string): void => {
  let caught: unknown;

  try {
    fn();
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeDefined();

  const message = caught instanceof Error ? caught.message : String(caught);
  if (typeof matcher === "string") {
    expect(message).toContain(matcher);
    return;
  }

  expect(message).toMatch(matcher);
};

/* ========================================================================== */
/* interpolate — numeric                                                      */
/* ========================================================================== */

describe("interpolate: numeric", () => {
  test("input and output range strictly monotonically increasing", () => {
    expect(interpolate(1, [0, 1], [0, 2])).toEqual(2);
  });

  test("input range strictly monotonically increasing, output non-increasing", () => {
    expect(interpolate(1, [0, 1], [2, 2])).toEqual(2);
  });

  test("interpolate with 4 values, output non-increasing", () => {
    expect(interpolate(Math.PI, [0, 1, 4, 9], [0, 2, 1000, -1000])).toEqual(714.4364894275378);
  });

  test("interpolate Infinity: output range increasing", () => {
    expect(interpolate(Infinity, [0, 1], [0, 2])).toEqual(Infinity);
  });

  test("interpolate Infinity: output range decreasing", () => {
    expect(interpolate(Infinity, [0, 1], [1, 0])).toEqual(-Infinity);
  });

  test("must be the same length", () => {
    expectToThrow(
      () => interpolate(1, [0, 2], [0, 1, 2]),
      /inputRange \(2 values provided\) and outputRange \(3 values provided\) must have the same length/,
    );
  });

  test("must pass at least 1 element for input range", () => {
    expectToThrow(() => interpolate(1, [], []), /inputRange must have at least 1 element/);
  });

  test("can interpolate a single keyframe", () => {
    expect(interpolate(-10, [20], [9])).toBe(9);
    expect(interpolate(20, [20], [9])).toBe(9);
    expect(interpolate(30, [20], [9])).toBe(9);
    expect(interpolate(30, [20], [9], { extrapolateRight: "identity" })).toBe(9);
  });

  test("extrapolation left test", () => {
    const testValues: ("extend" | undefined)[] = ["extend", undefined];
    testValues.forEach((entry) => {
      expect(interpolate(-3, [0, 1, 2], [0, 0.5, 1], { extrapolateRight: entry })).toEqual(-1.5);
    });
  });

  test("extrapolation right test", () => {
    const testValues: ("extend" | undefined)[] = ["extend", undefined];
    testValues.forEach((entry) => {
      expect(interpolate(3, [0, 1, 2], [0, 0.5, 1], { extrapolateRight: entry })).toEqual(1.5);
    });
  });

  test("extrapolation identity", () => {
    const testValues: [number, { extrapolateRight?: "identity"; extrapolateLeft?: "identity" }][] =
      [
        [1000, { extrapolateRight: "identity" }],
        [-1000, { extrapolateLeft: "identity" }],
      ];

    testValues.forEach((entry) => {
      expect(interpolate(entry[0], [0, 1, 2], [0, 2, 4], entry[1])).toBe(entry[0]);
    });
  });

  test("clamp right test", () => {
    expect(interpolate(2000, [0, 1, 1000], [0, 1, -1000], { extrapolateRight: "clamp" })).toEqual(
      -1000,
    );
  });

  test("clamp left test", () => {
    expect(
      interpolate(-2000, [0, 1, 1000], [Math.PI, 1, -1000], { extrapolateLeft: "clamp" }),
    ).toEqual(Math.PI);
  });

  test("zig-zag test", () => {
    const testValues: [number, number][] = [
      [3.5, -500],
      [4, -1000],
      [6, 3000],
      [-0.1, -1100],
    ];

    testValues.forEach((entry) => {
      expect(interpolate(entry[0], [1, 2, 3, 4, 5], [0, 1000, 0, -1000, 1000])).toBe(entry[1]);
    });
  });

  test("wrap option", () => {
    expect(interpolate(1.5, [0, 1], [0, 2], { extrapolateRight: "wrap" })).toBe(1);
    expect(interpolate(-0.5, [0, 1], [0, 2], { extrapolateLeft: "wrap" })).toBe(1);
  });

  test("output range can be non-monotonic", () => {
    expect(interpolate(0.75, [0, 0.5, 1], [0, 2, 0])).toEqual(1);
  });

  test("output range monotonically decreasing", () => {
    expect(interpolate(0.75, [0, 0.5, 1], [0, 2, 2])).toEqual(2);
  });

  test("input range must be strictly monotonically increasing", () => {
    expectToThrow(
      () => interpolate(1, [0, 1, 0.5], [0, 2, 0.2]),
      /inputRange must be strictly monotonically increasing/,
    );
    expectToThrow(
      () => interpolate(0.75, [0, 1, 1], [0, 2, 0]),
      /inputRange must be strictly monotonically increasing/,
    );
  });

  test("cannot have Infinity in input range", () => {
    expectToThrow(
      () => interpolate(1, [-Infinity, 0], [0, 2]),
      /inputRange must contain only finite numbers, but got \[-Infinity,0\]/,
    );
  });

  test("cannot have Infinity in output range", () => {
    expectToThrow(
      () => interpolate(1, [0, 1], [Infinity, 2]),
      /outputRange must contain only finite numbers, but got \[Infinity,2\]/,
    );
  });

  test("should throw if passing 2x infinity input range", () => {
    expectToThrow(
      () => interpolate(1, [Infinity, Infinity], [0, 2]),
      /inputRange must contain only finite numbers, but got \[Infinity,Infinity\]/,
    );
  });

  test("should throw if passing 2x infinity output range", () => {
    expectToThrow(
      () => interpolate(1, [0, 1], [-Infinity, Infinity]),
      /outputRange must contain only finite numbers, but got \[-Infinity,Infinity\]/,
    );
  });

  test("should throw on Infinity as third argument", () => {
    expectToThrow(
      () => interpolate(1, [0, 1, Infinity], [0, 2, 3]),
      /inputRange must contain only finite numbers, but got \[0,1,Infinity\]/,
    );
  });

  test("non-number input", () => {
    expectToThrow(
      // @ts-expect-error — deliberately wrong type
      () => interpolate("1", [0, 1], [1, 0]),
      /Cannot interpolate an input which is not a number/,
    );
  });

  test("non-array ranges", () => {
    expectToThrow(
      // @ts-expect-error — deliberately wrong type
      () => interpolate(1, "string", "string"),
      /inputRange must contain only numbers/,
    );
  });
});

/* ========================================================================== */
/* interpolate — easing                                                       */
/* ========================================================================== */

describe("interpolate: easing", () => {
  test("Easing test", () => {
    expect(interpolate(0.5, [0, 1], [0, 1], { easing: curve.sin })).toEqual(
      1 - Math.cos((0.5 * Math.PI) / 2),
    );
  });

  test("easing array: one easing per segment between keyframes", () => {
    const linear = (t: number) => t;
    const quad = (t: number) => t * t;
    // Midpoint of second segment [10, 20]: normalized t = 0.5, quad -> 0.25
    expect(interpolate(15, [0, 10, 20], [0, 10, 20], { easing: [linear, quad] })).toEqual(12.5);
  });

  test("easing array: first segment easing only affects first segment", () => {
    const linear = (t: number) => t;
    const quad = (t: number) => t * t;
    expect(interpolate(5, [0, 10, 20], [0, 10, 20], { easing: [quad, linear] })).toEqual(2.5);
  });

  test("easing array: same as single easing when all segments use the same function", () => {
    const single = interpolate(15, [0, 10, 20], [0, 100, 200], { easing: curve.linear });
    const arrayed = interpolate(15, [0, 10, 20], [0, 100, 200], {
      easing: [curve.linear, curve.linear],
    });
    expect(arrayed).toEqual(single);
  });

  test("easing array must have length inputRange.length - 1", () => {
    expectToThrow(
      () => interpolate(1, [0, 10, 20], [0, 1, 2], { easing: [curve.linear] }),
      /When easing is an array, it must have one entry per segment between keyframes \(length inputRange\.length - 1 = 2\), but got length 1/,
    );
  });

  test("easing array with two keyframes uses a single easing entry", () => {
    expect(interpolate(0.5, [0, 1], [0, 1], { easing: [curve.sin] })).toEqual(
      1 - Math.cos((0.5 * Math.PI) / 2),
    );
  });

  test("easing array with two keyframes rejects more than one entry", () => {
    expectToThrow(
      () => interpolate(0.5, [0, 1], [0, 1], { easing: [curve.linear, curve.linear] }),
      /When easing is an array, it must have one entry per segment between keyframes \(length inputRange\.length - 1 = 1\), but got length 2/,
    );
  });

  test("easing array with one keyframe accepts no entries", () => {
    expect(interpolate(0.5, [0], [1], { easing: [] })).toBe(1);
  });

  test("Easing.circle with default extrapolate extend clamps normalized input", () => {
    expect(interpolate(150, [0, 100], [0, 100], { easing: curve.circle })).toBe(100);
    expect(interpolate(-50, [0, 100], [0, 100], { easing: curve.circle })).toBe(0);
  });
});

/* ========================================================================== */
/* interpolate — posterize                                                    */
/* ========================================================================== */

describe("interpolate: posterize", () => {
  test("quantizes the input before interpolating", () => {
    expect(interpolate(17, [0, 60], [0, 1], { posterize: 3 })).toBe(0.25);
    expect(interpolate(19, [0, 30, 60], [0, 100, 200], { posterize: 10 })).toBe(33.33333333333333);
  });

  test("option must be a positive finite number", () => {
    expectToThrow(
      () => interpolate(10, [0, 20], [0, 1], { posterize: 0 }),
      /posterize must be a positive finite number, but got 0/,
    );
    expectToThrow(
      () => interpolate(10, [0, 20], [0, 1], { posterize: -1 }),
      /posterize must be a positive finite number, but got -1/,
    );
    expectToThrow(
      () => interpolate(10, [0, 20], [0, 1], { posterize: Infinity }),
      /posterize must be a positive finite number, but got Infinity/,
    );
    expectToThrow(
      () => interpolate(10, [0, 20], [0, 1], { posterize: NaN }),
      /posterize must be a positive finite number, but got NaN/,
    );
  });
});

/* ========================================================================== */
/* interpolate — numeric tuples                                               */
/* ========================================================================== */

describe("interpolate: numeric tuples", () => {
  test("interpolates numeric tuples component-wise", () => {
    expect(
      interpolate(
        30,
        [0, 60],
        [
          [0, 0.5],
          [1, 0.5],
        ],
      ),
    ).toEqual([0.5, 0.5]);

    expect(
      interpolate(
        15,
        [0, 30],
        [
          [1, 2, 3],
          [2, 4, 6],
        ],
      ),
    ).toEqual([1.5, 3, 4.5]);

    expect(
      interpolate(
        75,
        [0, 50, 100],
        [
          [0, 0],
          [1, 1],
          [0, 0.5],
        ],
      ),
    ).toEqual([0.5, 0.75]);
  });

  test("interpolates numeric tuples with one keyframe", () => {
    expect(interpolate(999, [0], [[0.2, 0.8]])).toEqual([0.2, 0.8]);
  });

  test("supports easing, extrapolation and posterization", () => {
    expect(
      interpolate(
        15,
        [0, 30],
        [
          [0, 0],
          [100, 50],
        ],
        { easing: curve.quad },
      ),
    ).toEqual([25, 12.5]);

    expect(
      interpolate(
        45,
        [0, 30],
        [
          [0, 0],
          [100, 50],
        ],
        { extrapolateRight: "clamp" },
      ),
    ).toEqual([100, 50]);

    expect(
      interpolate(
        19,
        [0, 30],
        [
          [0, 0],
          [90, 30],
        ],
        { posterize: 10 },
      ),
    ).toEqual([30, 10]);
  });

  test("throws on length mismatches and non-finite numbers", () => {
    expectToThrow(
      () =>
        interpolate(
          0,
          [0, 1],
          [
            [0, 0.5],
            [1, 0.5, 0],
          ],
        ),
      /outputRange tuples must all have the same length/,
    );
    expectToThrow(
      () =>
        interpolate(
          0,
          [0, 1],
          [
            [NaN, 0.5],
            [1, 0.5],
          ],
        ),
      // Remotion says "tuples"; the port words it per-tuple: "outputRange tuple
      // must contain only finite numbers". Same check, singular noun.
      /outputRange tuples? must contain only finite numbers/,
    );
    expectToThrow(
      () =>
        interpolate(
          0,
          [0, 1],
          [
            [Infinity, 0.5],
            [1, 0.5],
          ],
        ),
      /outputRange tuples? must contain only finite numbers/,
    );
    expectToThrow(
      () => interpolate(0, [0, 1], [[], [1, 0.5]]),
      /outputRange tuples must contain at least 1 number/,
    );
  });
});

/* ========================================================================== */
/* interpolate — strings                                                      */
/* ========================================================================== */

describe("interpolate: strings", () => {
  test("interpolates scale strings", () => {
    expect(interpolate(15, [0, 30], ["1", "2"])).toBe("1.5");
    expect(interpolate(15, [0, 30], ["1 2", "2 4"])).toBe("1.5 3");
  });

  test("interpolates translate strings", () => {
    expect(interpolate(15, [0, 30], ["0px", "100px"])).toBe("50px");
    expect(interpolate(15, [0, 30], ["0px 59px", "100px 0px"])).toBe("50px 29.5px");
    expect(interpolate(15, [0, 30], ["0px 59px 10rem", "100px 0px 20rem"])).toBe(
      "50px 29.5px 15rem",
    );
  });

  test("interpolates rotate strings", () => {
    expect(interpolate(15, [0, 30], ["0deg", "100deg"])).toBe("50deg");
    expect(interpolate(15, [0, 30], ["-10.5deg", "20.5deg"])).toBe("5deg");
    expect(interpolate(15, [0, 30], ["0turn", "0.5turn"])).toBe("0.25turn");
  });

  test("supports easing, extrapolation and posterization", () => {
    expect(interpolate(15, [0, 30], ["0px", "100px"], { easing: curve.quad })).toBe("25px");
    expect(interpolate(45, [0, 30], ["0deg", "100deg"], { extrapolateRight: "clamp" })).toBe(
      "100deg",
    );
    expect(interpolate(19, [0, 30], ["0px 0px", "90px 30px"], { posterize: 10 })).toBe("30px 10px");
  });

  test("throws on type and unit mismatches", () => {
    expectToThrow(
      () => interpolate(15, [0, 30], ["1", "100px"]),
      /Cannot interpolate scale values with translate values/,
    );
    expectToThrow(
      () => interpolate(15, [0, 30], ["0deg", "100px"]),
      /Cannot interpolate rotate values with translate values/,
    );
    expectToThrow(() => interpolate(15, [0, 30], ["0px", "100%"]), /different units on axis 1/);
    expectToThrow(() => interpolate(15, [0, 30], ["0deg", "0.5turn"]), /different units on axis 1/);
    expectToThrow(() => interpolate(15, [0, 30], ["0px", "1px 2px 3px 4px"]), /1 to 3 components/);
  });
});

/* ========================================================================== */
/* interpolateColors                                                          */
/* ========================================================================== */

describe("interpolateColors", () => {
  test("throws if color string is not right", () => {
    expectToThrow(
      () => interpolateColors(1, [0, 1], ["#fabgdf", "#ffaabb"]),
      /invalid color string #fabgdf provided/,
    );
  });

  test("throws for undefined parameters", () => {
    expectToThrow(
      // @ts-expect-error — deliberately undefined
      () => interpolateColors(undefined, ["#aaa", "#bbb"], ["#fff", "#000"]),
      /input can not be undefined/,
    );
    expectToThrow(
      // @ts-expect-error — deliberately undefined
      () => interpolateColors(1, undefined, ["#fff", "#000"]),
      /inputRange can not be undefined/,
    );
    expectToThrow(
      // @ts-expect-error — deliberately undefined
      () => interpolateColors(1, ["#fff", "#000"], undefined),
      /outputRange can not be undefined/,
    );
  });

  test("inputRange and outputRange must be of same length", () => {
    expectToThrow(
      () => interpolateColors(1, [1, 2, 3], ["#ffffff", "#aaaaaa"]),
      /inputRange \(3 values provided\) and outputRange \(2 values provided\) must have the same length/,
    );
  });

  test("basic interpolate colors", () => {
    expect(interpolateColors(1, [0, 1], ["#ffaadd", "#fabfdf"])).toBe("rgba(250, 191, 223, 1)");
  });

  test("posterize quantizes the input before interpolating colors", () => {
    expect(interpolateColors(17, [0, 60], ["black", "white"])).toBe("rgba(72, 72, 72, 1)");
    expect(interpolateColors(17, [0, 60], ["black", "white"], { posterize: 3 })).toBe(
      "rgba(64, 64, 64, 1)",
    );
  });

  test("posterize option must be a positive finite number for colors", () => {
    expectToThrow(
      () => interpolateColors(17, [0, 60], ["black", "white"], { posterize: 0 }),
      /posterize must be a positive finite number, but got 0/,
    );
  });

  test("easing remaps color interpolation", () => {
    expect(
      interpolateColors(0.5, [0, 1], ["black", "white"], { easing: (input) => input * input }),
    ).toBe("rgba(64, 64, 64, 1)");
  });

  test("easing array remaps color interpolation per segment", () => {
    expect(
      interpolateColors(15, [0, 10, 20], ["black", "red", "white"], {
        easing: [curve.linear, (input) => input * input],
      }),
    ).toBe("rgba(255, 64, 64, 1)");
  });

  test("easing array must have one entry per color segment", () => {
    expectToThrow(
      () =>
        interpolateColors(5, [0, 10, 20], ["black", "red", "white"], {
          easing: [curve.linear],
        }),
      /When easing is an array, it must have one entry per segment between keyframes/,
    );
  });

  test("can interpolate a single color keyframe", () => {
    expect(interpolateColors(-10, [20], ["blue"])).toBe("rgba(0, 0, 255, 1)");
    expect(interpolateColors(20, [20], ["blue"])).toBe("rgba(0, 0, 255, 1)");
    expect(interpolateColors(30, [20], ["blue"])).toBe("rgba(0, 0, 255, 1)");
  });

  test("clamp right", () => {
    expect(interpolateColors(2, [0, 1], ["#ffaadd", "#fabfdf"])).toBe("rgba(250, 191, 223, 1)");
  });

  test("clamp left", () => {
    expect(interpolateColors(-1, [0, 1], ["#ffaadd", "#fabfdf"])).toBe("rgba(255, 170, 221, 1)");
  });

  test("color shorthands", () => {
    expect(interpolateColors(1, [0, 1], ["#fad", "#fabfdf"])).toBe("rgba(250, 191, 223, 1)");
  });

  test("color names", () => {
    expect(interpolateColors(1, [0, 1], ["red", "blue"])).toBe("rgba(0, 0, 255, 1)");
  });

  test("mix transparency", () => {
    expect(interpolateColors(0.5, [0, 1], ["transparent", "blue"])).toBe("rgba(0, 0, 128, 0.5)");
  });

  test("hsl / hsla", () => {
    expect(interpolateColors(0.5, [0, 1], ["hsla(120, 100%, 25%, 0)", "blue"])).toBe(
      "rgba(0, 64, 128, 0.5)",
    );
    expect(interpolateColors(0.5, [0, 1], ["hsl(120, 50%, 50%)", "blue"])).toBe(
      "rgba(32, 96, 160, 1)",
    );
  });

  test("rgb standard interpolation", () => {
    expect(interpolateColors(0.5, [0, 1], ["rgb(0,0,0)", "rgb(255,255,255)"])).toBe(
      "rgba(128, 128, 128, 1)",
    );
  });

  test("rgb clamping", () => {
    expect(interpolateColors(0.5, [0, 1], ["rgb(-1,0,0)", "rgb(256,255,255)"])).toBe(
      "rgba(128, 128, 128, 1)",
    );
  });
});

/* ========================================================================== */
/* Easing — reference implementations, copied from Remotion                   */
/* ========================================================================== */

const numbersToTest = [-0.5, 0, 0.4, 0.5, 0.7, 1, 1.5];

// Matches clamping in `Easing.circle` / `Easing.bounce` for tests that compare
// to reference impls.
const clampUnit = (t: number): number => Math.min(1, Math.max(0, t));

describe("easing: in / out / inOut", () => {
  /** Runs the three Remotion assertions for one curve. */
  const checkCurve = (
    label: string,
    reference: (n: number) => number,
    refOut: (n: number) => number,
    refInOut: (n: number) => number,
    easing: (n: number) => number,
  ): void => {
    describe(`Easing ${label}`, () => {
      test("Easing In", () => {
        const easingIn = Easing.in(easing);
        numbersToTest.forEach((n) => expect(easingIn(n)).toBe(reference(n)));
      });

      test("Easing Out", () => {
        const easingOut = Easing.out(easing);
        numbersToTest.forEach((n) => expect(easingOut(n)).toBe(refOut(n)));
      });

      test("Easing In Out", () => {
        const easingInOut = Easing.inOut(easing);
        numbersToTest.forEach((n) => expect(easingInOut(n)).toBe(refInOut(n)));
      });
    });
  };

  const step0 = (n: number): number => (n > 0 ? 1 : 0);
  checkCurve(
    "step0",
    step0,
    (n) => 1 - step0(1 - n),
    (n) => {
      if (n >= 0.5) {
        return 1 - step0((1 - n) * 2) / 2;
      }
      return step0(n * 2) / 2;
    },
    curve.step0,
  );

  const step1 = (n: number): number => (n >= 1 ? 1 : 0);
  checkCurve(
    "step1",
    step1,
    (n) => 1 - step1(1 - n),
    (n) => {
      if (n >= 0.5) {
        return 1 - step1((1 - n) * 2) / 2;
      }
      return step1(n * 2) / 2;
    },
    curve.step1,
  );

  const quad = (n: number): number => n * n;
  checkCurve(
    "quad",
    quad,
    (n) => 1 - quad(1 - n),
    (n) => {
      if (n >= 0.5) {
        return 1 - quad((1 - n) * 2) / 2;
      }
      return quad(n * 2) / 2;
    },
    curve.quad,
  );

  const cubic = (n: number): number => n * n * n;
  checkCurve(
    "cubic",
    cubic,
    (n) => 1 - cubic(1 - n),
    (n) => {
      if (n >= 0.5) {
        return 1 - cubic((1 - n) * 2) / 2;
      }
      return cubic(n * 2) / 2;
    },
    curve.cubic,
  );

  const circle = (n: number): number => {
    const u = clampUnit(n);
    return 1 - Math.sqrt(1 - u * u);
  };
  checkCurve(
    "circle",
    circle,
    (n) => 1 - circle(1 - n),
    (n) => {
      if (n >= 0.5) {
        return 1 - circle((1 - n) * 2) / 2;
      }
      return circle(n * 2) / 2;
    },
    curve.circle,
  );

  const exp = (n: number): number => 2 ** (10 * (n - 1));
  checkCurve(
    "exp",
    exp,
    (n) => 1 - exp(1 - n),
    (n) => {
      if (n >= 0.5) {
        return 1 - exp((1 - n) * 2) / 2;
      }
      return exp(n * 2) / 2;
    },
    curve.exp,
  );

  const bounce = (n: number): number => {
    const u = clampUnit(n);

    if (u < 1 / 2.75) {
      return 7.5625 * u * u;
    }

    if (u < 2 / 2.75) {
      const t2_ = u - 1.5 / 2.75;
      return 7.5625 * t2_ * t2_ + 0.75;
    }

    if (u < 2.5 / 2.75) {
      const t2_ = u - 2.25 / 2.75;
      return 7.5625 * t2_ * t2_ + 0.9375;
    }

    const t2 = u - 2.625 / 2.75;
    return 7.5625 * t2 * t2 + 0.984375;
  };
  checkCurve(
    "bounce",
    bounce,
    (n) => 1 - bounce(1 - n),
    (n) => {
      if (n >= 0.5) {
        return 1 - bounce((1 - n) * 2) / 2;
      }
      return bounce(n * 2) / 2;
    },
    curve.bounce,
  );

  test("Easing linear is the identity for in, out and inOut", () => {
    numbersToTest.forEach((n) => expect(Easing.in(curve.linear)(n)).toBe(n));
    numbersToTest.forEach((n) => expect(Easing.out(curve.linear)(n)).toBe(n));
    numbersToTest.forEach((n) => expect(Easing.inOut(curve.linear)(n)).toBe(n));
  });
});

describe("easing: spring", () => {
  test("matches a duration-stretched spring", () => {
    const config = { damping: 12, mass: 0.8, stiffness: 150 };
    const easing = Easing.spring(config);

    for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      expect(easing(t)).toBe(spring({ fps: 30, frame: t * 30, durationInFrames: 30, config }));
    }
  });

  test("supports a custom rest threshold", () => {
    const config = { damping: 200, mass: 1, stiffness: 100 };
    const durationRestThreshold = 0.1;
    const easing = Easing.spring({ ...config, durationRestThreshold });

    for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      expect(easing(t)).toBe(
        spring({
          fps: 30,
          frame: t * 30,
          durationInFrames: 30,
          durationRestThreshold,
          config,
        }),
      );
    }
  });

  test("can leave a spring tail after the easing duration", () => {
    const config = { damping: 200, mass: 1, stiffness: 100 };
    const durationRestThreshold = 0.1;
    const easing = Easing.spring({
      ...config,
      allowTail: true,
      durationRestThreshold,
    });
    const naturalDuration = measureSpring({
      fps: 30,
      config,
      threshold: durationRestThreshold,
    });

    expect(easing(0.5)).toBe(spring({ fps: 30, frame: naturalDuration * 0.5, config }));
    expect(easing(1)).toBeLessThan(1);
    expect(easing(1.5)).toBeGreaterThan(easing(1));
    expect(easing(2)).toBeLessThanOrEqual(1);
  });

  test("clamps the endpoints", () => {
    const easing = Easing.spring();

    expect(easing(-1)).toBe(0);
    expect(easing(0)).toBe(0);
    expect(easing(1)).toBe(1);
    expect(easing(2)).toBe(1);
  });

  test("supports overshoot clamping", () => {
    expect(Easing.spring()(0.5)).toBeGreaterThan(1);
    expect(Easing.spring({ overshootClamping: true })(0.5)).toBe(1);
  });
});

/* ========================================================================== */
/* measureSpring / spring                                                     */
/* ========================================================================== */

describe("measureSpring", () => {
  const duration = measureSpring({ fps: 30 });

  test("measureSpring() is 28 frames at fps 30 with default config", () => {
    expect(duration).toBe(28);
  });

  test("spring should be close to 1 at the measured duration", () => {
    expect(spring({ fps: 30, frame: duration })).toBeCloseTo(1);
  });

  test("spring should not be 1 one frame earlier", () => {
    expect(spring({ fps: 30, frame: duration - 1 })).not.toBe(1);
  });

  test("higher threshold leads to a faster spring", () => {
    expect(measureSpring({ fps: 30, threshold: 0.05 })).toBeLessThan(
      measureSpring({ fps: 30, threshold: 0.01 }),
    );
  });

  test("lower threshold leads to a slower spring", () => {
    expect(measureSpring({ fps: 30, threshold: 0.001 })).toBeGreaterThan(
      measureSpring({ fps: 30, threshold: 0.01 }),
    );
  });

  test("threshold edge cases", () => {
    const validEdgeCases: [number, number][] = [
      [0, Infinity],
      [1, 0],
    ];
    validEdgeCases.forEach((entry) => {
      expect(measureSpring({ fps: 30, threshold: entry[0] })).toBe(entry[1]);
    });
  });

  test("threshold error cases", () => {
    const errorEdgeCases: [number | null, RegExp][] = [
      [NaN, /Threshold is NaN/],
      [Infinity, /Threshold is not finite/],
      [null, /threshold must be a number, got null of type object/],
    ];
    errorEdgeCases.forEach((entry) => {
      expectToThrow(
        // @ts-expect-error — deliberately wrong type
        () => measureSpring({ fps: 30, threshold: entry[0] }),
        entry[1],
      );
    });
  });
});

/* ========================================================================== */
/* bezier                                                                     */
/* ========================================================================== */

const bezierIdentity = (x: number): number => x;

const assertClose = (a: number, b: number, precision = 3): void => {
  expect(a).toBeCloseTo(b, precision);
};

const allEquals = (
  be1: (x: number) => number,
  be2: (x: number) => number,
  samples: number,
): void => {
  for (let i = 0; i <= samples; ++i) {
    const x = i / samples;
    assertClose(be1(x), be2(x));
  }
};

describe("bezier", () => {
  test("should create an object", () => {
    expect(typeof bezier(0, 0, 1, 1) === "function").toBe(true);
  });

  test("fail with wrong params", () => {
    const valuesToTest: [number, number, number, number][] = [
      [0.5, 0.5, -5, 0.5],
      [0.5, 0.5, 5, 0.5],
      [-2, 0.5, 0.5, 0.5],
      [2, 0.5, 0.5, 0.5],
    ];

    valuesToTest.forEach((entry) => {
      expect(() => bezier(entry[0], entry[1], entry[2], entry[3])).toThrow();
    });
  });

  test("linear curves", () => {
    allEquals(bezier(0, 0, 1, 1), bezier(1, 1, 0, 0), 100);
    allEquals(bezier(0, 0, 1, 1), bezierIdentity, 100);
  });

  test("right value at extremes", () => {
    // Fixed control points instead of Remotion's `Math.random()` so a failure
    // is reproducible. Same assertion, deterministic inputs.
    const controlPoints: [number, number, number, number][] = [
      [0.1, 0.2, 0.3, 0.4],
      [0.25, -0.25, 0.75, 0.25],
      [0.42, 0, 1, 1],
      [0.9, 0.1, 0.1, 0.9],
      [0.5, -0.5, 0.5, 1.5],
    ];

    controlPoints.forEach(([a, b, c, d]) => {
      const easing = bezier(a, b, c, d);
      expect(easing(0)).toBe(0);
      expect(easing(1)).toBe(1);
    });
  });

  test("clamps evaluation input to [0, 1]", () => {
    const linear = bezier(0, 0, 1, 1);
    expect(linear(-2)).toBe(0);
    expect(linear(3)).toBe(1);

    const curved = bezier(0.42, 0, 1, 1);
    expect(Number.isFinite(curved(2))).toBe(true);
    expect(Number.isFinite(curved(-1))).toBe(true);
  });
});
