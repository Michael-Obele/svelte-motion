/**
 * Wall-clock animation guard.
 *
 * A frame must be a pure function of `frame`. Anything driven by the browser's
 * clock — a `transition:` directive, a CSS `@keyframes` animation, a hand-rolled
 * `requestAnimationFrame` loop — is at an arbitrary position when the renderer
 * takes the screenshot, so the same composition renders different bytes on
 * different runs and the determinism gate cannot hold.
 *
 * We cannot make those animations seekable, but we can refuse to be silent about
 * them: after every seek, any animation still running is reported once. The
 * message is prefixed `[svelte-motion]`, which is the channel the renderer already
 * collects into `RenderResult.warnings` (`packages/renderer/src/render.ts`).
 *
 * The filter is `running` / `pending` only. A finished animation with
 * `animation-fill-mode: forwards` stays in `document.getAnimations()` and is
 * perfectly deterministic — it is a static style at this point, not a clock.
 */

/** Identities already reported, so a 1,800-frame render produces one warning each. */
const reported = new Set<string>();

/** Test escape hatch: forget what has been reported. */
export const resetWallClockWarnings = (): void => {
  reported.clear();
};

/** Names the pending reads on the animation, without assuming a subclass exists. */
type AnimationHints = {
  /** `AnimationPlayState` in the lib, but `"pending"` is what engines return for an
   *  animation with a resolved-but-not-yet-started start time, and TS omits it. */
  playState?: string;
  animationName?: string;
  transitionProperty?: string;
  effect?: { target?: Element | null } | null;
};

/** A label worth putting in a warning: what the author would recognise as the cause. */
const describe = (animation: Animation): string => {
  const hints = animation as unknown as AnimationHints;

  if (typeof hints.animationName === "string" && hints.animationName !== "") {
    return `animation "${hints.animationName}"`;
  }

  if (typeof hints.transitionProperty === "string" && hints.transitionProperty !== "") {
    return `transition on ${hints.transitionProperty}`;
  }

  const target = hints.effect?.target;

  if (target !== null && target !== undefined) {
    return `Web animation on <${target.nodeName.toLowerCase()}>`;
  }

  return "Web animation";
};

const isRunning = (animation: Animation): boolean => {
  const { playState } = animation as unknown as AnimationHints;

  return playState === "running" || playState === "pending";
};

/**
 * Reports animations that are still on the browser clock at this frame.
 *
 * Called after the seek has flushed and painted, which is the only moment the
 * answer is meaningful: before the flush the styles of the new frame have not
 * been applied yet, and a CSS transition they start has not begun.
 *
 * Never throws. `document.getAnimations` is absent under jsdom and in old
 * engines, and a guard that breaks a render is worse than a guard that misses.
 */
export const warnOnWallClockAnimations = (frame: number): void => {
  if (typeof document === "undefined" || typeof document.getAnimations !== "function") {
    return;
  }

  let running: string[];

  try {
    running = document
      .getAnimations()
      .filter(isRunning)
      .map((animation) => describe(animation));
  } catch {
    return;
  }

  for (const label of running) {
    if (reported.has(label)) {
      continue;
    }

    reported.add(label);
    console.warn(
      `[svelte-motion] ${label} was still running at frame ${frame}. Wall-clock ` +
        "animation is not seekable, so it renders differently on every run — drive it " +
        "from the frame instead (`interpolate`, `spring`, or `use:frameTransition` for " +
        "a Svelte transition factory).",
    );
  }
};
