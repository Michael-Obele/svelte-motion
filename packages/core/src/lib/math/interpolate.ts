/**
 * Range mapping.
 *
 * Ported from Remotion 4.0.538 (`packages/core/src/interpolate.ts`), which is
 * itself a port of React Native's `AnimatedInterpolation`. The numeric path is
 * copied line for line because the M1 gate compares output against Remotion.
 *
 * What this file deliberately does NOT port from upstream, because nothing in
 * v1 uses it: the `outputType` CSS sugar (`font-weight`, `transform-origin`,
 * axis rotations, `perceptual-scale`). Passing those is rejected with a clear
 * error rather than silently producing different numbers.
 */

export type ExtrapolateType = "extend" | "identity" | "clamp" | "wrap";

/**
 * An easing function. `svelteMotionShouldExtendRight` mirrors Remotion's marker:
 * when a spring-style easing sets it, clamping the right edge would freeze the
 * curve mid-flight, so the segment is extended instead.
 */
export type EasingFunction = ((input: number) => number) & {
  readonly svelteMotionShouldExtendRight?: boolean;
};

export type InterpolateOptions = Partial<{
  easing: EasingFunction | readonly EasingFunction[];
  extrapolateLeft: ExtrapolateType;
  extrapolateRight: ExtrapolateType;
  posterize: number;
}>;

type InterpolateOutputValue = number | string | readonly number[];

const defaultEasing = (num: number): number => num;

const findRange = (input: number, inputRange: readonly number[]): number => {
  let i: number;
  for (i = 1; i < inputRange.length - 1; ++i) {
    if (inputRange[i] >= input) {
      break;
    }
  }

  return i - 1;
};

const shouldExtendRightForEasing = (easing: EasingFunction): boolean =>
  easing.svelteMotionShouldExtendRight === true;

const resolveEasingForSegment = ({
  easing,
  segmentIndex,
}: {
  easing: InterpolateOptions["easing"];
  segmentIndex: number;
}): EasingFunction => {
  if (easing === undefined) {
    return defaultEasing;
  }

  if (typeof easing === "function") {
    return easing;
  }

  return easing[segmentIndex] as EasingFunction;
};

const interpolateFunction = (
  input: number,
  inputRange: [number, number],
  outputRange: [number, number],
  options: {
    extrapolateLeft: ExtrapolateType;
    extrapolateRight: ExtrapolateType;
    easing: EasingFunction;
  },
): number => {
  const { extrapolateLeft, extrapolateRight, easing } = options;

  let result = input;
  const [inputMin, inputMax] = inputRange;
  const [outputMin, outputMax] = outputRange;

  if (result < inputMin) {
    if (extrapolateLeft === "identity") {
      return result;
    }

    if (extrapolateLeft === "clamp") {
      result = inputMin;
    } else if (extrapolateLeft === "wrap") {
      const range = inputMax - inputMin;
      result = ((((result - inputMin) % range) + range) % range) + inputMin;
    }
  }

  if (result > inputMax) {
    if (extrapolateRight === "identity") {
      return result;
    }

    if (extrapolateRight === "clamp") {
      result = inputMax;
    } else if (extrapolateRight === "wrap") {
      const range = inputMax - inputMin;
      result = ((((result - inputMin) % range) + range) % range) + inputMin;
    }
  }

  if (outputMin === outputMax) {
    return outputMin;
  }

  // Normalise into the input segment, ease, then map into the output segment.
  result = (result - inputMin) / (inputMax - inputMin);
  result = easing(result);

  return result * (outputMax - outputMin) + outputMin;
};

const interpolateSegment = ({
  input,
  inputRange,
  outputRange,
  easing,
  extrapolateLeft,
  extrapolateRight,
}: {
  input: number;
  inputRange: [number, number];
  outputRange: [number, number];
  easing: EasingFunction;
  extrapolateLeft: ExtrapolateType;
  extrapolateRight: ExtrapolateType;
}): number =>
  interpolateFunction(input, inputRange, outputRange, {
    easing,
    extrapolateLeft,
    extrapolateRight:
      input > inputRange[1] && extrapolateRight === "clamp" && shouldExtendRightForEasing(easing)
        ? "extend"
        : extrapolateRight,
  });

const interpolateNumber = ({
  input,
  inputRange,
  outputRange,
  options,
}: {
  input: number;
  inputRange: readonly number[];
  outputRange: readonly number[];
  options: InterpolateOptions | undefined;
}): number => {
  if (inputRange.length === 1) {
    return outputRange[0];
  }

  const easingOption = options?.easing;

  const extrapolateLeft: ExtrapolateType = options?.extrapolateLeft ?? "extend";
  const extrapolateRight: ExtrapolateType = options?.extrapolateRight ?? "extend";

  const posterizedInput =
    options?.posterize === undefined
      ? input
      : Math.floor(input / options.posterize) * options.posterize;

  const range = findRange(posterizedInput, inputRange);
  const easing = resolveEasingForSegment({ easing: easingOption, segmentIndex: range });

  let result = interpolateSegment({
    input: posterizedInput,
    inputRange: [inputRange[range], inputRange[range + 1]],
    outputRange: [outputRange[range], outputRange[range + 1]],
    easing,
    extrapolateLeft,
    extrapolateRight,
  });

  // Earlier segments whose easing extends right must keep contributing past
  // their own end, so add their continued value on top of this segment.
  for (let segmentIndex = 0; segmentIndex < range; segmentIndex++) {
    const previousEasing = resolveEasingForSegment({
      easing: easingOption,
      segmentIndex,
    });

    if (!shouldExtendRightForEasing(previousEasing)) {
      continue;
    }

    const previousSegmentEnd = inputRange[segmentIndex + 1];
    if (posterizedInput <= previousSegmentEnd) {
      continue;
    }

    const continuedSegmentValue = interpolateSegment({
      input: posterizedInput,
      inputRange: [inputRange[segmentIndex], previousSegmentEnd],
      outputRange: [outputRange[segmentIndex], outputRange[segmentIndex + 1]],
      easing: previousEasing,
      extrapolateLeft,
      extrapolateRight: "extend",
    });

    result += continuedSegmentValue - outputRange[segmentIndex + 1];
  }

  return result;
};

/* -------------------------------------------------------------------------- */
/* String interpolation — uniform-unit CSS-ish values                          */
/* -------------------------------------------------------------------------- */

const angleUnits = new Set(["deg", "rad", "grad", "turn"]);

const lengthUnits = new Set([
  "%",
  "cap",
  "ch",
  "cm",
  "cqb",
  "cqh",
  "cqi",
  "cqmax",
  "cqmin",
  "cqw",
  "dvh",
  "dvw",
  "em",
  "ex",
  "ic",
  "in",
  "lh",
  "lvh",
  "lvw",
  "mm",
  "pc",
  "pt",
  "px",
  "q",
  "rem",
  "rlh",
  "svh",
  "svw",
  "vb",
  "vh",
  "vi",
  "vmax",
  "vmin",
  "vw",
]);

const cssNumberRegex = /^([+-]?(?:\d+\.?\d*|\.\d+))([a-zA-Z%]+)?$/;

type StringKind = "scale" | "translate" | "rotate";

type ParsedStringValue = {
  kind: StringKind;
  values: number[];
  units: (string | null)[];
};

const stringifyNumber = (value: number): string => String(Math.round(value * 1000000) / 1000000);

const parseComponent = (
  component: string,
  whole: string,
): { kind: StringKind; value: number; unit: string | null } => {
  const match = cssNumberRegex.exec(component);
  if (match === null) {
    throw new TypeError(
      `Cannot interpolate "${whole}" because "${component}" is not a supported scale, translate, or rotate value. ` +
        "Interpolate the number and build the string yourself, e.g. `${x}px`.",
    );
  }

  const unit = match[2] ?? null;
  const value = Number(match[1]);

  if (!Number.isFinite(value)) {
    throw new TypeError(`Cannot interpolate "${whole}" because "${component}" is not finite`);
  }

  if (unit === null) {
    return { kind: "scale", value, unit: null };
  }

  if (angleUnits.has(unit)) {
    return { kind: "rotate", value, unit };
  }

  if (lengthUnits.has(unit)) {
    return { kind: "translate", value, unit };
  }

  throw new TypeError(
    `Cannot interpolate "${whole}" because "${unit}" is not a supported translate or rotate unit`,
  );
};

const parseStringValue = (output: string): ParsedStringValue => {
  const parts = output.trim().split(/\s+/);

  if (parts.length < 1 || parts.length > 3 || parts[0] === "") {
    throw new TypeError(
      `String outputRange values must contain 1 to 3 components, but got "${output}"`,
    );
  }

  const parsed = parts.map((part) => parseComponent(part, output));
  const kind = parsed[0].kind;
  for (const part of parsed) {
    if (part.kind !== kind) {
      throw new TypeError(
        `Cannot interpolate "${output}" because it mixes ${kind} and ${part.kind} values`,
      );
    }
  }

  return {
    kind,
    values: parsed.map((part) => part.value),
    units: parsed.map((part) => part.unit),
  };
};

const serializeStringValue = ({ kind, values, units }: ParsedStringValue): string => {
  if (kind === "scale") {
    return values.map((value) => stringifyNumber(value)).join(" ");
  }

  return values.map((value, index) => `${stringifyNumber(value)}${units[index] ?? ""}`).join(" ");
};

const interpolateString = ({
  input,
  inputRange,
  outputRange,
  options,
}: {
  input: number;
  inputRange: readonly number[];
  outputRange: readonly string[];
  options: InterpolateOptions | undefined;
}): string => {
  const parsedOutputRange = outputRange.map(parseStringValue);
  const kind = parsedOutputRange[0].kind;
  const dimensions = parsedOutputRange[0].values.length;

  for (const parsed of parsedOutputRange) {
    if (parsed.kind !== kind) {
      throw new TypeError(`Cannot interpolate ${kind} values with ${parsed.kind} values`);
    }

    if (parsed.values.length !== dimensions) {
      throw new TypeError(
        `Cannot interpolate string values with ${dimensions} and ${parsed.values.length} components`,
      );
    }
  }

  const units: (string | null)[] = [];
  if (kind !== "scale") {
    for (let axis = 0; axis < dimensions; axis++) {
      let resolved: string | null = null;

      for (const parsed of parsedOutputRange) {
        const unit = parsed.units[axis];
        if (unit === null) {
          throw new TypeError(
            `Cannot interpolate ${kind} values because axis ${axis + 1} has no unit`,
          );
        }

        if (resolved === null) {
          resolved = unit;
          continue;
        }

        if (resolved !== unit) {
          throw new TypeError(
            `Cannot interpolate ${kind} values with different units on axis ${axis + 1}: ${resolved} and ${unit}`,
          );
        }
      }

      units.push(resolved);
    }
  }

  const values = Array.from({ length: dimensions }, (_, axis) =>
    interpolateNumber({
      input,
      inputRange,
      outputRange: parsedOutputRange.map((parsed) => parsed.values[axis]),
      options,
    }),
  );

  return serializeStringValue({ kind, values, units });
};

/* -------------------------------------------------------------------------- */
/* Validation                                                                  */
/* -------------------------------------------------------------------------- */

const checkValidInputRange = (arr: readonly number[]): void => {
  for (let i = 1; i < arr.length; ++i) {
    if (!(arr[i] > arr[i - 1])) {
      throw new Error(
        `inputRange must be strictly monotonically increasing but got [${arr.join(",")}]`,
      );
    }
  }
};

const checkInfiniteRange = (name: string, arr: readonly number[]): void => {
  if (arr.length < 1) {
    throw new Error(`${name} must have at least 1 element`);
  }

  for (const element of arr) {
    if (typeof element !== "number") {
      throw new Error(`${name} must contain only numbers`);
    }

    if (!Number.isFinite(element)) {
      throw new Error(`${name} must contain only finite numbers, but got [${arr.join(",")}]`);
    }
  }
};

const assertValidEasing = (
  easing: EasingFunction | readonly EasingFunction[] | undefined,
  inputRangeLength: number,
): void => {
  if (easing === undefined || typeof easing === "function") {
    return;
  }

  const expectedLength = inputRangeLength - 1;
  if (easing.length !== expectedLength) {
    throw new Error(
      `When easing is an array, it must have one entry per segment between keyframes ` +
        `(length inputRange.length - 1 = ${expectedLength}), but got length ${easing.length}`,
    );
  }
};

const assertValidPosterize = (posterize: number | undefined): void => {
  if (posterize === undefined) {
    return;
  }

  if (typeof posterize !== "number" || !Number.isFinite(posterize) || posterize <= 0) {
    throw new Error(
      `posterize must be a positive finite number, but got ${posterize} of type ${typeof posterize}`,
    );
  }
};

/* -------------------------------------------------------------------------- */
/* Public API                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Maps `input` from `inputRange` onto `outputRange`.
 *
 * @param input - Value to map, usually the current frame
 * @param inputRange - Strictly increasing keyframes, at least 2
 * @param outputRange - One output per keyframe; all numbers, all same-length
 *   number tuples, or all CSS strings sharing units
 * @param options - Easing, extrapolation, posterize
 */
export function interpolate(
  input: number,
  inputRange: readonly number[],
  outputRange: readonly number[],
  options?: InterpolateOptions,
): number;
export function interpolate(
  input: number,
  inputRange: readonly number[],
  outputRange: readonly string[],
  options?: InterpolateOptions,
): string;
export function interpolate(
  input: number,
  inputRange: readonly number[],
  outputRange: readonly (readonly number[])[],
  options?: InterpolateOptions,
): number[];
export function interpolate(
  input: number,
  inputRange: readonly number[],
  outputRange: readonly InterpolateOutputValue[],
  options?: InterpolateOptions,
): InterpolateOutputValue;
export function interpolate(
  input: number,
  inputRange: readonly number[],
  outputRange: readonly InterpolateOutputValue[],
  options?: InterpolateOptions,
): InterpolateOutputValue {
  checkInfiniteRange("inputRange", inputRange);
  checkValidInputRange(inputRange);
  assertValidEasing(options?.easing, inputRange.length);
  assertValidPosterize(options?.posterize);

  if (typeof input !== "number") {
    throw new TypeError("Cannot interpolate an input which is not a number");
  }

  if (inputRange.length !== outputRange.length) {
    throw new TypeError(
      `inputRange (${inputRange.length} values provided) and outputRange ` +
        `(${outputRange.length} values provided) must have the same length`,
    );
  }

  if (outputRange.length === 0) {
    throw new Error("outputRange must have at least 1 element");
  }

  if (outputRange.some((output) => typeof output === "boolean")) {
    throw new TypeError(
      "Boolean outputRange is not supported in v1. Use a numeric range and pick the value yourself.",
    );
  }

  if (outputRange.every((output) => typeof output === "number")) {
    checkInfiniteRange("outputRange", outputRange as readonly number[]);
    return interpolateNumber({
      input,
      inputRange,
      outputRange: outputRange as readonly number[],
      options,
    });
  }

  if (outputRange.every((output) => typeof output === "string")) {
    return interpolateString({
      input,
      inputRange,
      outputRange: outputRange as readonly string[],
      options,
    });
  }

  if (outputRange.every((output) => Array.isArray(output))) {
    const tuples = outputRange as readonly (readonly number[])[];
    const dimensions = tuples[0].length;

    if (dimensions === 0) {
      throw new TypeError("outputRange tuples must contain at least 1 number");
    }

    for (const tuple of tuples) {
      if (tuple.length !== dimensions) {
        throw new TypeError(
          `outputRange tuples must all have the same length, but got ${dimensions} and ${tuple.length}`,
        );
      }

      checkInfiniteRange("outputRange tuple", tuple);
    }

    return Array.from({ length: dimensions }, (_, axis) =>
      interpolateNumber({
        input,
        inputRange,
        outputRange: tuples.map((tuple) => tuple[axis]),
        options,
      }),
    );
  }

  throw new TypeError(
    "outputRange must contain only numbers, same-length number tuples, or CSS strings",
  );
}

/**
 * Pre-resolves an interpolation into a single-argument function.
 *
 * Useful in a render loop: validation runs once instead of per frame.
 */
export const prepareNumericInterpolation = ({
  inputRange,
  outputRange,
  options,
}: {
  inputRange: readonly number[];
  outputRange: readonly number[];
  options?: InterpolateOptions;
}): ((input: number) => number) => {
  // Run the same validation interpolate() would, once.
  interpolate(inputRange[0], inputRange, outputRange, options);

  return (input) => interpolateNumber({ input, inputRange, outputRange, options });
};
