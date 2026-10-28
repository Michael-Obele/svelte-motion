/**
 * Where are we running?
 *
 * The renderer, the studio and a plain player all render the same components, but
 * some behaviour has to differ: asset prefetching, cursor hiding, autoplay. The
 * renderer sets `window.svelteMotion_*` flags before the bundle evaluates.
 */

export type SvelteMotionEnvironment = {
  /** Running inside the studio dev server. */
  isStudio: boolean;
  /** Running under the headless renderer. */
  isRendering: boolean;
  /** Running inside a `<Player>` in a normal page. */
  isPlayer: boolean;
};

const readFlag = (name: string): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  return (window as unknown as Record<string, unknown>)[name] === true;
};

/** Reads the environment flags set by whichever shell is rendering. */
export const getSvelteMotionEnvironment = (): SvelteMotionEnvironment => ({
  isStudio: readFlag("svelteMotion_isStudio"),
  isRendering: readFlag("svelteMotion_isRendering"),
  isPlayer: readFlag("svelteMotion_isPlayer"),
});

/**
 * Sets an environment flag.
 *
 * The renderer calls this with `svelteMotion_isRendering` before navigation.
 * Passing `false` clears the flag: `getSvelteMotionEnvironment` only treats an
 * exact `true` as set, so a route can unset its flag on destroy and leave no
 * stale surface behind.
 */
export const setSvelteMotionEnvironmentFlag = (name: string, value: boolean): void => {
  if (typeof window === "undefined") {
    return;
  }

  (window as unknown as Record<string, unknown>)[name] = value;
};
