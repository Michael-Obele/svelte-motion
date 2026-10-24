/**
 * Browser driving.
 *
 * Everything here talks to the composition host through the `svelteMotion_*`
 * globals it publishes. That indirection is deliberate: the renderer must never
 * import `@svelte-motion/core`, because core is browser code and pulling it into
 * Node would drag Svelte runes and `window` into a process that has neither.
 *
 * The frame contract (see `MotionRoot.svelte`):
 *
 * - `svelteMotion_ready()` is a boolean — `false` while an asset is still loading;
 * - `svelteMotion_setFrame(n)` is async and resolves only *after* Svelte flushed
 *   and the browser painted, so a screenshot taken after the await cannot capture
 *   the previous frame;
 * - `svelteMotion_getCompositions()` lists what the bundle can render.
 */

import type { Browser, Page } from "playwright";
import { chromium } from "playwright";

/** A composition described by the page. Deliberately not `CompositionConfig`:
 *  the renderer has no access to core's types, and the page cannot serialise a
 *  component reference across the CDP boundary anyway. */
export type PageComposition = {
  id: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  defaultProps?: Record<string, unknown>;
};

/** Pixel size of one frame. */
export type FrameSize = { width: number; height: number };

/**
 * How long the page gets to become ready.
 *
 * A composition that `delayRender`s on remote fonts can legitimately take a while
 * on a cold cache, but a hung frame must fail the render instead of stalling it.
 */
const READY_TIMEOUT_MS = 30_000;

/** The `svelteMotion_*` surface, as seen from inside the page. */
type PageBridge = {
  svelteMotion_ready?: () => boolean;
  svelteMotion_setFrame?: (frame: number) => Promise<void>;
  svelteMotion_getCompositions?: () => readonly unknown[];
};

/** Launches headless Chromium. The caller owns `close()`. */
export const launchBrowser = (): Promise<Browser> =>
  chromium.launch({
    headless: true,
    args: [
      // Text is the one thing that can differ between two runs of the same frame:
      // LCD subpixel antialiasing blends against a background the compositor
      // decides on. The M0 gate proved these flags keep output byte-identical.
      "--disable-lcd-text",
      "--font-render-hinting=none",
      "--force-color-profile=srgb",
      "--disable-gpu",
      "--hide-scrollbars",
    ],
  });

/** Rejects when the page never reports ready, so a blank frame cannot be encoded. */
const waitForReady = async (page: Page): Promise<void> => {
  await page.waitForFunction(
    () => (window as unknown as PageBridge).svelteMotion_ready?.() === true,
    undefined,
    { timeout: READY_TIMEOUT_MS },
  );
};

/** Waits for web fonts, which change text metrics and therefore pixels. */
const waitForFonts = async (page: Page): Promise<void> => {
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
};

/**
 * Opens one composition at frame 0.
 *
 * @param page - Page to drive (the caller decides its viewport size)
 * @param url - Origin from `serveBuild()`
 * @param compositionId - Registry id, e.g. `hello-world`
 * @param props - Composition props; omitted from the URL when `undefined`
 */
export const openComposition = async (
  page: Page,
  url: string,
  compositionId: string,
  props?: Record<string, unknown>,
): Promise<void> => {
  const origin = url.replace(/\/+$/, "");
  let target = `${origin}/render?composition=${encodeURIComponent(compositionId)}&frame=0`;

  if (props !== undefined) {
    // `encodeURIComponent` escapes `+`, `&` and `#`, so the JSON survives the
    // query string intact. The host parses it with `JSON.parse`.
    target += `&props=${encodeURIComponent(JSON.stringify(props))}`;
  }

  await page.goto(target, { waitUntil: "load" });

  try {
    await waitForReady(page);
  } catch (error) {
    throw new Error(
      `Composition "${compositionId}" never reported ready within ${READY_TIMEOUT_MS}ms at frame 0 — ` +
        "a delayRender() handle is probably still open, or the page failed to load",
      { cause: error },
    );
  }

  await waitForFonts(page);
};

/** Reads the registry the page publishes, projected to what the renderer needs. */
export const getCompositionsFromPage = async (page: Page): Promise<PageComposition[]> => {
  return await page.evaluate((): PageComposition[] => {
    const raw = (window as unknown as PageBridge).svelteMotion_getCompositions?.() ?? [];

    return raw.map((entry) => {
      const config = entry as PageComposition;

      return {
        id: config.id,
        width: config.width,
        height: config.height,
        fps: config.fps,
        durationInFrames: config.durationInFrames,
        defaultProps: config.defaultProps,
      };
    });
  });
};

/**
 * Drives the page to `frame` and screenshots it.
 *
 * @param page - Page already opened with `openComposition()`
 * @param frame - Absolute frame number
 * @param size - Clip size, normally the composition's `width`/`height`
 * @returns PNG bytes, ready to pipe into FFmpeg
 */
export const captureFrame = async (
  page: Page,
  frame: number,
  size: FrameSize,
): Promise<Uint8Array> => {
  // The await is the whole point: it resolves after the flush and the paint, so
  // the screenshot below cannot race the previous frame.
  await page.evaluate(async (target: number) => {
    await (window as unknown as PageBridge).svelteMotion_setFrame?.(target);
  }, frame);

  // A frame can open new handles (an image that only appears at frame 40), so
  // readiness is re-checked after every seek, not just once at load.
  try {
    await waitForReady(page);
  } catch (error) {
    // TODO(task-5): name the pending handles here. The page reports readiness as
    // a boolean today; `getPendingLabels()` does not cross the bridge yet, and an
    // error that says *which* asset stalled beats one that says "timed out".
    throw new Error(
      `Frame ${frame} never reported ready within ${READY_TIMEOUT_MS}ms — a delayRender() handle opened on this frame is still open`,
      { cause: error },
    );
  }

  await waitForFonts(page);

  const png = await page.screenshot({
    clip: { x: 0, y: 0, width: size.width, height: size.height },
    type: "png",
  });

  return new Uint8Array(png);
};
