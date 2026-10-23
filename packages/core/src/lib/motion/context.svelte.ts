/**
 * The frame runtime.
 *
 * `frame` is the single source of truth. Everything animates by deriving from it,
 * never by writing to it from an effect. The renderer drives it through
 * `window.svelteMotion_setFrame`; the player drives it through the same setter.
 *
 * This file must stay a `.svelte.ts` module: runes inside classes are compiled
 * by the Svelte plugin, and that only happens for `.svelte.js` / `.svelte.ts`.
 */

import { getContext, setContext } from "svelte";

/** Shape every composition is rendered at. */
export type VideoConfig = {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
};

/** Everything a component can read about the frame it is being drawn at. */
export type MotionState = VideoConfig & {
  /** Current frame, local to the nearest enclosing `Sequence`. */
  readonly frame: number;
};

const MOTION_KEY = Symbol("svelte-motion/context");

/**
 * Root frame state. One instance per rendered composition.
 *
 * Reads of `frame` and the config fields are reactive; the renderer writes
 * `frame` and Svelte re-runs whatever derived values depend on it.
 */
export class MotionContext implements MotionState {
  #frame = $state(0);

  fps = $state(30);
  width = $state(1920);
  height = $state(1080);
  durationInFrames = $state(90);

  constructor(config: Partial<VideoConfig> = {}) {
    if (config.fps !== undefined) this.fps = config.fps;
    if (config.width !== undefined) this.width = config.width;
    if (config.height !== undefined) this.height = config.height;
    if (config.durationInFrames !== undefined) this.durationInFrames = config.durationInFrames;
  }

  get frame(): number {
    return this.#frame;
  }

  set frame(next: number) {
    this.#frame = next;
  }

  /** Move to a frame. Named so intent is obvious at call sites. */
  seek(frame: number): void {
    this.#frame = frame;
  }
}

/**
 * A view onto a parent context whose frame is computed from the parent's.
 *
 * `Sequence` shifts, `Loop` wraps, `Freeze` pins — all through this one class, so
 * there is a single place where "local frame" is defined. Reads go through the
 * parent getters, which keeps reactivity intact at any nesting depth.
 */
export class DerivedMotionContext implements MotionState {
  #parent: MotionState;
  #deriveFrame: (parent: MotionState) => number;

  constructor(parent: MotionState, deriveFrame: (parent: MotionState) => number) {
    this.#parent = parent;
    this.#deriveFrame = deriveFrame;
  }

  get frame(): number {
    return this.#deriveFrame(this.#parent);
  }

  get fps(): number {
    return this.#parent.fps;
  }

  get width(): number {
    return this.#parent.width;
  }

  get height(): number {
    return this.#parent.height;
  }

  get durationInFrames(): number {
    return this.#parent.durationInFrames;
  }
}

/** Publishes a context to descendants. Must be called during component init. */
export const setMotionContext = (context: MotionState): MotionState => {
  setContext(MOTION_KEY, context);
  return context;
};

/**
 * Reads the nearest enclosing context.
 *
 * @throws If called outside a `MotionRoot`, or during a module's top-level scope
 */
export const getMotionContext = (): MotionState => {
  const context = getContext<MotionState | undefined>(MOTION_KEY);

  if (context === undefined) {
    throw new Error(
      "No motion context found. Wrap the tree in <MotionRoot>, or call this inside a component.",
    );
  }

  return context;
};

/** Current frame, local to the nearest enclosing `Sequence`. */
export const useCurrentFrame = (): number => getMotionContext().frame;

/** Composition config: `fps`, `width`, `height`, `durationInFrames`. */
export const useVideoConfig = (): VideoConfig => {
  const context = getMotionContext();

  return {
    fps: context.fps,
    width: context.width,
    height: context.height,
    durationInFrames: context.durationInFrames,
  };
};
