import type { Component } from "svelte";

/**
 * Props for `Player`. Named types live here so `vp check` can see them:
 * named exports from `.svelte` files are invisible to `svelte-check`.
 *
 * `component` is typed `Component<any, any, any>` rather than `Component<Props>`
 * because Svelte props are contravariant: a component declared with no props is
 * `Component<Record<string, never>, {}, "">`, and neither `Record<string, unknown>`
 * nor `Record<string, any>` is assignable to `Record<string, never>`, so every
 * static composition would fail to type-check against `<Player>`. The `Props`
 * generic still types `inputProps`, which is where the prop shape is written.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- see the note above */
export type PlayerProps<Props extends Record<string, any> = Record<string, any>> = {
  /** Svelte component to render inside the Stage. */
  component: Component<any, any, any>;
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
  /**
   * Whether playback is running. Bindable, so a host can render its own
   * transport instead of the built-in one and still show the real state.
   * Default false.
   */
  isPlaying?: boolean;
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
