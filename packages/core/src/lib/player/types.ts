import type { Component } from "svelte";

/**
 * Props for `Player`. Named types live here so `vp check` can see them:
 * named exports from `.svelte` files are invisible to `svelte-check`.
 */
export type PlayerProps<Props extends Record<string, unknown> = Record<string, unknown>> = {
  /** Svelte component to render inside the Stage. */
  component: Component<Props>;
  /** Props spread onto the component. */
  inputProps?: Props;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  /** Frame to start on. Default 0. */
  startFrame?: number;
  /** Start playing on mount. Default false. */
  autoPlay?: boolean;
  /** Wrap at the end. Default true. */
  loop?: boolean;
  /** Show built-in controls. Default true. */
  controls?: boolean;
  /** Test seam: clock. Default `() => performance.now()`. */
  now?: () => number;
  /** Test seam: schedule. Default `requestAnimationFrame`. */
  schedule?: (callback: FrameRequestCallback) => number;
  /** Test seam: cancel. Default `cancelAnimationFrame`. */
  cancel?: (handle: number) => void;
  /** Called whenever the frame changes (play tick or seek). */
  onFrame?: (frame: number) => void;
};

/** Props for `PlayerControls`. */
export type PlayerControlsProps = {
  frame: number;
  durationInFrames: number;
  fps: number;
  isPlaying: boolean;
  onplay: () => void;
  onpause: () => void;
  onseek: (frame: number) => void;
};
