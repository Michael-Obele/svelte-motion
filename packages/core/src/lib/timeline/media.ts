/**
 * Props for the media components.
 *
 * Each type lives here rather than inside its `.svelte` file because the
 * type-aware checker (`vp check`) cannot see named exports of `.svelte`
 * modules — see `timeline/types.ts` for the same pattern.
 *
 * The event-handler props (`onload`, `onerror`, `onloadeddata`, `onseeked`)
 * are composed with the components' internal readiness handlers: the internal
 * handler runs first (it releases the `delayRender` handle), then the
 * forwarded user callback runs. A user callback can therefore never disable
 * readiness bookkeeping.
 */

import type {
  HTMLAudioAttributes,
  HTMLIframeAttributes,
  HTMLImgAttributes,
  HTMLVideoAttributes,
} from "svelte/elements";

export type ImgProps = {
  /** Path inside `static/` (resolved through `staticFile`) or an absolute URL. */
  src: string;
} & Omit<HTMLImgAttributes, "src">;

export type VideoProps = {
  /** Path inside `static/` (resolved through `staticFile`) or an absolute URL. */
  src: string;
  /** Frame offset added to the current frame before computing `currentTime`. */
  startFrom?: number;
} & Omit<HTMLVideoAttributes, "src">;

export type AudioProps = {
  /** Path inside `static/` (resolved through `staticFile`) or an absolute URL. */
  src: string;
  /** Frame offset added to the current frame before computing `currentTime`. */
  startFrom?: number;
} & Omit<HTMLAudioAttributes, "src">;

export type IFrameProps = {
  /** Path inside `static/` (resolved through `staticFile`) or an absolute URL. */
  src: string;
} & Omit<HTMLIframeAttributes, "src">;
