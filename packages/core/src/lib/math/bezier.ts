/**
 * Cubic bezier easing curve.
 *
 * Solves a CSS `cubic-bezier(x1, y1, x2, y2)` timing function by Newton-Raphson
 * iteration with a subdivision fallback. The constants and iteration counts are
 * load-bearing: changing them changes the output curve.
 */

const NEWTON_ITERATIONS = 4;
const NEWTON_MIN_SLOPE = 0.001;
const SUBDIVISION_PRECISION = 0.0000001;
const SUBDIVISION_MAX_ITERATIONS = 10;

const kSplineTableSize = 11;
const kSampleStepSize = 1.0 / (kSplineTableSize - 1.0);

const coefA = (aA1: number, aA2: number): number => 1.0 - 3.0 * aA2 + 3.0 * aA1;
const coefB = (aA1: number, aA2: number): number => 3.0 * aA2 - 6.0 * aA1;
const coefC = (aA1: number): number => 3.0 * aA1;

/** Evaluates x(t) for x1/x2, or y(t) for y1/y2. */
const calcBezier = (aT: number, aA1: number, aA2: number): number =>
  ((coefA(aA1, aA2) * aT + coefB(aA1, aA2)) * aT + coefC(aA1)) * aT;

/** Evaluates dx/dt for x1/x2, or dy/dt for y1/y2. */
const getSlope = (aT: number, aA1: number, aA2: number): number =>
  3.0 * coefA(aA1, aA2) * aT * aT + 2.0 * coefB(aA1, aA2) * aT + coefC(aA1);

const binarySubdivide = (
  aX: number,
  _aA: number,
  _aB: number,
  mX1: number,
  mX2: number,
): number => {
  let currentX: number;
  let currentT: number;
  let i = 0;
  let aA = _aA;
  let aB = _aB;

  do {
    currentT = aA + (aB - aA) / 2.0;
    currentX = calcBezier(currentT, mX1, mX2) - aX;
    if (currentX > 0.0) {
      aB = currentT;
    } else {
      aA = currentT;
    }
  } while (Math.abs(currentX) > SUBDIVISION_PRECISION && ++i < SUBDIVISION_MAX_ITERATIONS);

  return currentT;
};

const newtonRaphsonIterate = (aX: number, _aGuessT: number, mX1: number, mX2: number): number => {
  let aGuessT = _aGuessT;

  for (let i = 0; i < NEWTON_ITERATIONS; ++i) {
    const currentSlope = getSlope(aGuessT, mX1, mX2);
    if (currentSlope === 0.0) {
      return aGuessT;
    }

    const currentX = calcBezier(aGuessT, mX1, mX2) - aX;
    aGuessT -= currentX / currentSlope;
  }

  return aGuessT;
};

/** Builds a cubic bezier easing function with control points (0,0), (x1,y1), (x2,y2), (1,1). */
export const bezier = (
  mX1: number,
  mY1: number,
  mX2: number,
  mY2: number,
): ((x: number) => number) => {
  if (!(mX1 >= 0 && mX1 <= 1 && mX2 >= 0 && mX2 <= 1)) {
    throw new Error("bezier x values must be in [0, 1] range");
  }

  const sampleValues = new Float32Array(kSplineTableSize);

  if (mX1 !== mY1 || mX2 !== mY2) {
    for (let i = 0; i < kSplineTableSize; ++i) {
      sampleValues[i] = calcBezier(i * kSampleStepSize, mX1, mX2);
    }
  }

  const getTForX = (aX: number): number => {
    let intervalStart = 0.0;
    let currentSample = 1;
    const lastSample = kSplineTableSize - 1;

    for (; currentSample !== lastSample && sampleValues[currentSample] <= aX; ++currentSample) {
      intervalStart += kSampleStepSize;
    }

    --currentSample;

    // Linear interpolation gives Newton-Raphson a starting guess.
    const dist =
      (aX - sampleValues[currentSample]) /
      (sampleValues[currentSample + 1] - sampleValues[currentSample]);
    const guessForT = intervalStart + dist * kSampleStepSize;

    const initialSlope = getSlope(guessForT, mX1, mX2);
    if (initialSlope >= NEWTON_MIN_SLOPE) {
      return newtonRaphsonIterate(aX, guessForT, mX1, mX2);
    }

    if (initialSlope === 0.0) {
      return guessForT;
    }

    return binarySubdivide(aX, intervalStart, intervalStart + kSampleStepSize, mX1, mX2);
  };

  return (x: number): number => {
    const clampedX = Math.min(1, Math.max(0, x));

    if (mX1 === mY1 && mX2 === mY2) {
      return clampedX; // linear
    }

    // Floating point means the extremes need to be pinned explicitly.
    if (clampedX === 0) {
      return 0;
    }

    if (clampedX === 1) {
      return 1;
    }

    return calcBezier(getTForX(clampedX), mY1, mY2);
  };
};
