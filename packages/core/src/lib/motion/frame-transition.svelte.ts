/**
 * Frame-driven Svelte transitions.
 *
 * Svelte's `transition:` directive is an **interaction** primitive: it fires when
 * an element enters or leaves the DOM, and runs on the Web Animations API clock.
 * A video frame must be a pure function of `frame`, so a directive that restarts
 * on every seek cannot be captured — seeking to frame 45 mounts the element, the
 * intro starts at `t = 0`, and the screenshot shows the beginning of the
 * transition instead of its middle. See `docs/adr/0005`.
 *
 * The useful half of the built-ins is not the directive, it is the factory behind
 * it. `fly(node, params)` returns a `TransitionConfig` whose `css(t, u)` /
 * `tick(t, u)` are pure functions of progress. This action keeps those factories
 * and replaces the driver with the motion context's frame, so the same code that
 * animates in the browser at 60 fps produces byte-identical PNGs in the renderer.
 * Nothing here calls `animate()`: at screenshot time no wall-clock animation
 * exists, which is what `wall-clock.ts` checks for.
 *
 * ```svelte
 * <script>
 *   import { fly } from "svelte/transition";
 *   import { frameTransition, Sequence } from "@svelte-motion/core";
 * </script>
 *
 * <Sequence from={30} durationInFrames={45}>
 *   <div use:frameTransition={{ fn: fly, params: { y: 200 }, durationInFrames: 15 }}>
 *     flies in over frames 30-45, then holds
 *   </div>
 * </Sequence>
 * ```
 */

import { untrack } from "svelte";
import type { Action } from "svelte/action";
import type { TransitionConfig } from "svelte/transition";
import { getMotionContext, type MotionState } from "./context.svelte.js";

/** `"in"` runs 0 → 1, `"out"` runs 1 → 0, matching Svelte's own directions. */
export type FrameTransitionDirection = "in" | "out";

/**
 * A Svelte transition factory: `fly`, `fade`, `blur`, `slide`, `scale`, `draw`,
 * or any function returning a `TransitionConfig`.
 *
 * `node` and `params` are loose on purpose — the built-ins disagree on both
 * (`fly` takes an `Element`, `draw` an `SVGElement`, `slide` measures the node),
 * and this type only has to accept what the factory already accepts.
 */
export type FrameTransitionFunction = (
  node: any,
  params?: any,
  options?: { direction: FrameTransitionDirection | "both" },
) => TransitionConfig;

/** The bag passed to `use:frameTransition={{ ... }}`. */
export type FrameTransitionOptions = {
  /** The transition factory to drive. */
  fn: FrameTransitionFunction;
  /** Params for the factory. Its own `duration`/`delay` are in ms and are
   *  converted to frames through `fps` unless overridden below. */
  params?: any;
  /** Local frame the transition starts on — relative to the enclosing
   *  `<Sequence>`, the same frame the children see. Default `0`. */
  from?: number;
  /** Length in frames. Wins over the factory's `duration`. */
  durationInFrames?: number;
  /** Hold at the start value for this many frames. Wins over `delay`. */
  delayInFrames?: number;
  /** Default `"in"`. */
  direction?: FrameTransitionDirection;
  /** Context override. Defaults to the nearest enclosing `Sequence`/`MotionRoot`. */
  motion?: MotionState;
};

/** Everything the per-frame maths needs, resolved once per options object. */
type Resolved = {
  config: TransitionConfig;
  direction: FrameTransitionDirection;
  /** First frame that is not the natural state. */
  startFrame: number;
  /** Frames between start and end. `<= 0` means an instantaneous change. */
  lengthFrames: number;
};

const MS_PER_SECOND = 1000;

const framesFromMs = (ms: number, fps: number): number =>
  Math.max(0, Math.round((ms / MS_PER_SECOND) * fps));

const identity = (t: number): number => t;

/**
 * Splits a `css(t, u)` return into property/value pairs.
 *
 * The contract is a CSS declaration list (`"opacity:0.5;transform:translate(...)"`),
 * so the first `:` of each statement is the separator. Values containing `;`
 * (`url("a;b")`) are not something a built-in emits.
 */
const parseDeclarations = (source: string): [string, string][] => {
  const parsed: [string, string][] = [];

  for (const statement of source.split(";")) {
    const separator = statement.indexOf(":");

    if (separator <= 0) {
      continue;
    }

    const property = statement.slice(0, separator).trim();
    const value = statement.slice(separator + 1).trim();

    if (property !== "") {
      parsed.push([property, value]);
    }
  }

  return parsed;
};

/** Removes exactly the properties this action applied, leaving the author's alone. */
const clearApplied = (node: HTMLElement, applied: Set<string>): void => {
  for (const property of applied) {
    node.style.removeProperty(property);
  }

  applied.clear();
};

/**
 * The whole animation model, as a function of `frame`.
 *
 * Progress is clamped **before** easing so an overshooting curve (`backOut`,
 * `elasticOut`) can still exceed the range in its output, exactly as Svelte does;
 * the clamp only stops a seek past either end from feeding it nonsense.
 */
const applyAtFrame = (
  node: HTMLElement,
  resolved: Resolved,
  frame: number,
  applied: Set<string>,
): void => {
  const { config, direction, startFrame, lengthFrames } = resolved;
  const offset = frame - startFrame;
  const progress = lengthFrames <= 0 ? (offset >= 0 ? 1 : 0) : offset / lengthFrames;

  // At the natural end there is nothing to express: the element must fall back to
  // its own styles, the way Svelte removes the animation when an intro finishes.
  const atNaturalState = direction === "in" ? progress >= 1 : progress <= 0;

  if (atNaturalState) {
    clearApplied(node, applied);
    return;
  }

  const eased = (config.easing ?? identity)(Math.min(1, Math.max(0, progress)));
  const t = direction === "out" ? 1 - eased : eased;
  const u = 1 - t;

  if (config.css !== undefined) {
    const declarations = parseDeclarations(config.css(t, u));

    for (const [property, value] of declarations) {
      node.style.setProperty(property, value);
      applied.add(property);
    }

    return;
  }

  if (config.tick !== undefined) {
    config.tick(t, u);
    return;
  }

  clearApplied(node, applied);
};

/**
 * Drives a Svelte transition factory from the frame instead of the clock.
 *
 * The factory is called once per options object, not once per frame: `slide`,
 * `scale` and `draw` measure the node (`getBoundingClientRect`,
 * `getComputedStyle`, `getTotalLength`) and that measurement is taken as
 * constant for the life of the transition.
 *
 * Reads `frame` inside an effect, so it is the DOM-write equivalent of a
 * `$derived` — it never writes to state, and it runs in the same flush as the
 * seek, before `MotionRoot` resolves the paint.
 */
export const frameTransition: Action<HTMLElement, FrameTransitionOptions | undefined> = (
  node,
  options,
) => {
  // Resolved during component init, where context is available. `options.motion`
  // lets a caller that creates the element outside an effect root pass it in.
  const motion = options?.motion ?? getMotionContext();
  // A plain Set on purpose: it is bookkeeping read and written only inside the
  // effect below, never rendered. A reactive `SvelteSet` would make the effect
  // depend on its own writes.
  const applied = new Set<string>();
  let current = $state(options);
  let cache: { options: FrameTransitionOptions; resolved: Resolved } | null = null;

  const resolve = (opts: FrameTransitionOptions): Resolved => {
    const direction = opts.direction ?? "in";
    // Measure the node as if we had never touched it. `scale` and `fly` read
    // `getComputedStyle(node).transform`, so re-resolving while our own transform
    // is applied would feed that value back into the next measurement.
    clearApplied(node, applied);
    const config = opts.fn(node, opts.params, { direction });
    // fps is init-only config; read it untracked so the intent is explicit.
    const fps = untrack(() => motion.fps);
    const lengthFrames =
      opts.durationInFrames ?? Math.max(1, framesFromMs(config.duration ?? 0, fps));

    return {
      config,
      direction,
      lengthFrames,
      startFrame: (opts.from ?? 0) + (opts.delayInFrames ?? framesFromMs(config.delay ?? 0, fps)),
    };
  };

  $effect(() => {
    const opts = current;
    const frame = motion.frame;

    if (opts === undefined) {
      clearApplied(node, applied);
      return;
    }

    if (cache === null || cache.options !== opts) {
      cache = { options: opts, resolved: resolve(opts) };
    }

    applyAtFrame(node, cache.resolved, frame, applied);
  });

  return {
    update: (next) => {
      current = next;
    },
    destroy: () => {
      clearApplied(node, applied);
      cache = null;
    },
  };
};
