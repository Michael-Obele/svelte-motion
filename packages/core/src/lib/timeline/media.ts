/**
 * Props for the media components.
 *
 * Each type lives here rather than inside its `.svelte` file because the
 * type-aware checker (`vp check`) cannot see named exports of `.svelte`
 * modules — see `timeline/types.ts` for the same pattern.
 */

export type ImgProps = {
  /** Path inside `static/` (resolved through `staticFile`) or an absolute URL. */
  src: string;
  alt?: string;
  style?: string;
  /** Any other attributes forwarded to `<img>` (e.g. `width`, `height`, `class`). */
  [key: string]: unknown;
};

export type VideoProps = {
  /** Path inside `static/` (resolved through `staticFile`) or an absolute URL. */
  src: string;
  /** Frame offset added to the current frame before computing `currentTime`. */
  startFrom?: number;
  muted?: boolean;
  volume?: number;
  style?: string;
  [key: string]: unknown;
};

export type AudioProps = {
  /** Path inside `static/` (resolved through `staticFile`) or an absolute URL. */
  src: string;
  /** Frame offset added to the current frame before computing `currentTime`. */
  startFrom?: number;
  volume?: number;
  [key: string]: unknown;
};

export type IFrameProps = {
  /** Path inside `static/` (resolved through `staticFile`) or an absolute URL. */
  src: string;
  style?: string;
  [key: string]: unknown;
};
