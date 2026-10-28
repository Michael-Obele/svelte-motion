/**
 * Spring physics.
 *
 * A semi-analytic damped harmonic oscillator advanced once per frame. The frame
 * loop, the 64 ms delta cap, and the memo caches are load-bearing: spring() is
 * path dependent, so the same animation evaluated in a different order gives
 * different numbers.
 */

import { interpolate } from "./interpolate.js";

export type SpringConfig = {
  damping: number;
  mass: number;
  stiffness: number;
  overshootClamping: boolean;
};

type AnimationNode = {
  lastTimestamp: number;
  toValue: number;
  current: number;
  velocity: number;
  prevPosition?: number;
};

const defaultSpringConfig: SpringConfig = {
  damping: 10,
  mass: 1,
  stiffness: 100,
  overshootClamping: false,
};

const advanceCache = new Map<string, AnimationNode>();
const calculationCache = new Map<string, AnimationNode>();
const measureCache = new Map<string, number>();

const advance = ({
  animation,
  now,
  config,
}: {
  animation: AnimationNode;
  now: number;
  config: SpringConfig;
}): AnimationNode => {
  const { toValue, lastTimestamp, current, velocity } = animation;

  // Cap the step so a long gap cannot blow the oscillator up.
  const deltaTime = Math.min(now - lastTimestamp, 64);

  if (config.damping <= 0) {
    throw new Error(
      "Spring damping must be greater than 0, otherwise the spring() animation will never end, causing an infinite loop.",
    );
  }

  const c = config.damping;
  const m = config.mass;
  const k = config.stiffness;

  const cacheKey = [toValue, lastTimestamp, current, velocity, c, m, k, now].join("-");

  const cached = advanceCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const v0 = -velocity;
  const x0 = toValue - current;

  const zeta = c / (2 * Math.sqrt(k * m)); // damping ratio
  const omega0 = Math.sqrt(k / m); // undamped angular frequency (rad/ms)
  const omega1 = omega0 * Math.sqrt(1 - zeta ** 2); // damped angular frequency

  const t = deltaTime / 1000;

  const sin1 = Math.sin(omega1 * t);
  const cos1 = Math.cos(omega1 * t);

  // Under-damped
  const underDampedEnvelope = Math.exp(-zeta * omega0 * t);
  const underDampedFrag1 =
    underDampedEnvelope * (sin1 * ((v0 + zeta * omega0 * x0) / omega1) + x0 * cos1);

  const underDampedPosition = toValue - underDampedFrag1;
  // Derivative of the oscillation above.
  const underDampedVelocity =
    zeta * omega0 * underDampedFrag1 -
    underDampedEnvelope * (cos1 * (v0 + zeta * omega0 * x0) - omega1 * x0 * sin1);

  // Critically damped
  const criticallyDampedEnvelope = Math.exp(-omega0 * t);
  const criticallyDampedPosition =
    toValue - criticallyDampedEnvelope * (x0 + (v0 + omega0 * x0) * t);

  const criticallyDampedVelocity =
    criticallyDampedEnvelope * (v0 * (t * omega0 - 1) + t * x0 * omega0 * omega0);

  const animationNode: AnimationNode = {
    toValue,
    prevPosition: current,
    lastTimestamp: now,
    current: zeta < 1 ? underDampedPosition : criticallyDampedPosition,
    velocity: zeta < 1 ? underDampedVelocity : criticallyDampedVelocity,
  };

  advanceCache.set(cacheKey, animationNode);
  return animationNode;
};

const resolveConfig = (config: Partial<SpringConfig>): SpringConfig => ({
  // An explicit `undefined` must not overwrite the default, or the physics turn
  // into NaN.
  damping: config.damping ?? defaultSpringConfig.damping,
  mass: config.mass ?? defaultSpringConfig.mass,
  stiffness: config.stiffness ?? defaultSpringConfig.stiffness,
  overshootClamping: config.overshootClamping ?? defaultSpringConfig.overshootClamping,
});

/** Advances the oscillator from frame 0 up to `frame` and returns the node. */
export const springCalculation = ({
  frame,
  fps,
  config = {},
}: {
  frame: number;
  fps: number;
  config?: Partial<SpringConfig>;
}): AnimationNode => {
  const from = 0;
  const to = 1;

  const resolvedConfig = resolveConfig(config);
  const configKey = [
    fps,
    resolvedConfig.damping,
    resolvedConfig.mass,
    resolvedConfig.overshootClamping,
    resolvedConfig.stiffness,
  ].join("-");

  const cacheKey = `${frame}-${configKey}`;
  const cached = calculationCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const frameClamped = Math.max(0, frame);
  // Only resume from an integer frame: fractional steps change the simulation.
  const previousFrame = Math.ceil(frameClamped) - 1;
  const previousAnimation =
    previousFrame >= 0 ? calculationCache.get(`${previousFrame}-${configKey}`) : undefined;

  let animation: AnimationNode = previousAnimation ?? {
    lastTimestamp: 0,
    current: from,
    toValue: to,
    velocity: 0,
    prevPosition: 0,
  };

  const unevenRest = frameClamped % 1;
  const startFrame = previousAnimation ? previousFrame + 1 : 0;

  for (let f = startFrame; f <= Math.floor(frameClamped); f++) {
    const time = (f / fps) * 1000;
    animation = advance({ animation, now: time, config: resolvedConfig });
  }

  if (unevenRest > 0) {
    animation = advance({
      animation,
      now: (frameClamped / fps) * 1000,
      config: resolvedConfig,
    });
  }

  calculationCache.set(cacheKey, animation);
  return animation;
};

const assertFps = (fps: number, context: string): void => {
  if (typeof fps !== "number" || Number.isNaN(fps)) {
    throw new TypeError(`fps must be a number, but got ${typeof fps}`);
  }

  if (fps <= 0) {
    throw new TypeError(`fps must be greater than 0, but got ${fps}`);
  }

  if (!Number.isFinite(fps)) {
    throw new TypeError(`fps must be finite in ${context}`);
  }
};

/** Natural settle time of a spring, in frames. */
export const measureSpring = ({
  fps,
  config = {},
  threshold = 0.005,
}: {
  fps: number;
  config?: Partial<SpringConfig>;
  threshold?: number;
}): number => {
  // `threshold` is typed `number`, so by the time the narrowing runs TS has
  // nothing left to compare against — read it through an `unknown` alias so the
  // error message can still report what actually arrived.
  const received: unknown = threshold;

  if (typeof received !== "number") {
    throw new TypeError(
      `threshold must be a number, got ${String(received)} of type ${typeof received}`,
    );
  }

  if (threshold === 0) {
    return Infinity;
  }

  if (threshold === 1) {
    return 0;
  }

  if (Number.isNaN(threshold)) {
    throw new TypeError("Threshold is NaN");
  }

  if (!Number.isFinite(threshold)) {
    throw new TypeError("Threshold is not finite");
  }

  if (threshold < 0) {
    throw new TypeError("Threshold is below 0");
  }

  const cacheKey = [
    fps,
    config.damping,
    config.mass,
    config.overshootClamping,
    config.stiffness,
    threshold,
  ].join("-");

  const cached = measureCache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  assertFps(fps, "measureSpring()");

  // A spring with no restoring force never moves, so it is at rest on frame 0.
  // Without this guard omega0 is 0 and the damping ratio is infinity, which
  // turns every step into NaN and makes the settle loop unbounded.
  if (resolveConfig(config).stiffness <= 0) {
    return 0;
  }

  let frame = 0;
  const calc = () => springCalculation({ fps, frame, config });
  const calcDifference = (animation: AnimationNode) =>
    Math.abs(animation.current - animation.toValue);

  let animation = calc();
  let difference = calcDifference(animation);

  while (difference >= threshold) {
    frame++;
    animation = calc();
    difference = calcDifference(animation);
  }

  // A bouncing spring can dip under the threshold and come back, so keep
  // animating until it stays under for 20 frames straight.
  let finishedFrame = frame;
  for (let i = 0; i < 20; i++) {
    frame++;
    animation = calc();
    difference = calcDifference(animation);
    if (difference >= threshold) {
      i = 0;
      finishedFrame = frame + 1;
    }
  }

  measureCache.set(cacheKey, finishedFrame);

  return finishedFrame;
};

/**
 * Maps a frame to a spring position.
 *
 * @param frame - Frame to evaluate, relative to `delay`
 * @param fps - Frames per second of the composition
 * @param config - Physics overrides; omitted keys fall back to the defaults
 * @param from - Value at rest before the spring starts
 * @param to - Value the spring settles on
 * @param durationInFrames - Stretch or squash the spring into this many frames
 * @param durationRestThreshold - Sensitivity used when stretching
 * @param delay - Frames to wait before the spring starts
 * @param reverse - Run the spring backwards from `to`
 */
export const spring = ({
  frame: passedFrame,
  fps,
  config = {},
  from = 0,
  to = 1,
  durationInFrames: passedDurationInFrames,
  durationRestThreshold,
  delay = 0,
  reverse = false,
}: {
  frame: number;
  fps: number;
  config?: Partial<SpringConfig>;
  from?: number;
  to?: number;
  durationInFrames?: number;
  durationRestThreshold?: number;
  delay?: number;
  reverse?: boolean;
}): number => {
  if (
    passedDurationInFrames !== undefined &&
    (!Number.isInteger(passedDurationInFrames) || passedDurationInFrames <= 0)
  ) {
    throw new TypeError(
      `durationInFrames must be a positive integer, but got ${passedDurationInFrames}`,
    );
  }

  if (typeof passedFrame !== "number" || !Number.isFinite(passedFrame)) {
    throw new TypeError(`frame must be a finite number, but got ${passedFrame}`);
  }

  assertFps(fps, "spring()");

  const resolvedConfig = resolveConfig(config);

  // Degenerate springs are already at rest. Zero stiffness has no restoring
  // force (omega0 = 0, so the damping ratio is infinite), and a zero rest
  // threshold measures an infinite natural duration; either one turns the
  // frame loop into an unbounded calculation rather than an animation.
  if (
    resolvedConfig.stiffness <= 0 ||
    (durationRestThreshold !== undefined && durationRestThreshold <= 0)
  ) {
    return to;
  }

  const needsToCalculateNaturalDuration = reverse || typeof passedDurationInFrames !== "undefined";

  const naturalDuration = needsToCalculateNaturalDuration
    ? measureSpring({ fps, config, threshold: durationRestThreshold })
    : undefined;

  const naturalDurationGetter = () => {
    if (naturalDuration === undefined) {
      throw new Error(
        "did not calculate natural duration, this is an error with Svelte Motion. Please report it.",
      );
    }

    return naturalDuration;
  };

  const reverseProcessed = reverse
    ? (passedDurationInFrames ?? naturalDurationGetter()) - passedFrame
    : passedFrame;

  const delayProcessed = reverseProcessed + (reverse ? delay : -delay);

  const durationProcessed =
    passedDurationInFrames === undefined
      ? delayProcessed
      : delayProcessed / (passedDurationInFrames / naturalDurationGetter());

  if (passedDurationInFrames && delayProcessed > passedDurationInFrames) {
    return to;
  }

  const spr = springCalculation({ fps, frame: durationProcessed, config });

  // Clamp after scaling, not before: `spr.current` is normalised to 0..1, so
  // comparing it against a custom `to` (say 100) never clamps anything.
  const scaled =
    from === 0 && to === 1 ? spr.current : interpolate(spr.current, [0, 1], [from, to]);

  if (!config.overshootClamping) {
    return scaled;
  }

  return to >= from ? Math.min(scaled, to) : Math.max(scaled, to);
};
