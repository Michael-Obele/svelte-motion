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

/**
 * Chromium flags that keep two runs of the same frame identical.
 *
 * Text is the one thing that can differ between two runs of the same frame: LCD
 * subpixel antialiasing blends against a background the compositor decides on.
 * The M0 gate produced byte-identical passes with these flags — that is a
 * correlation, not a proof of causation, so read this list as "known to work"
 * rather than "each one is necessary".
 *
 * Exported because the determinism spikes must launch the same browser the
 * renderer does; a second, hand-copied list would drift from this one and the
 * gate would then be measuring a browser nobody ships.
 */
export const CHROMIUM_DETERMINISM_FLAGS: readonly string[] = [
  "--disable-lcd-text",
  "--font-render-hinting=none",
  "--force-color-profile=srgb",
  "--disable-gpu",
  "--hide-scrollbars",
];

/** Launches headless Chromium. The caller owns `close()`. */
export const launchBrowser = (): Promise<Browser> =>
  chromium.launch({
    headless: true,
    args: [...CHROMIUM_DETERMINISM_FLAGS],
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
 * How long to wait for the composition-registry bridge to appear after navigation.
 *
 * The bridge is installed in `onMount` after SvelteKit hydrates, which is fast
 * (hundreds of ms) but not instant after `load`. Waiting for it here lets
 * callers inspect the registry without paying the 30 s ready timeout.
 */
const BRIDGE_TIMEOUT_MS = 5_000;

const waitForBridge = async (page: Page): Promise<void> => {
  await page.waitForFunction(
    () => typeof (window as unknown as PageBridge).svelteMotion_getCompositions === "function",
    { timeout: BRIDGE_TIMEOUT_MS },
  );
};

/**
 * Navigates to one composition at frame 0 without waiting for readiness.
 *
 * Separated from the ready wait so callers can inspect the registry before
 * paying the 30 s timeout — a typo in the id should fail instantly. Waits for
 * the composition-registry bridge (installed in `onMount` after hydration) so
 * `getCompositionsFromPage` can be called immediately after.
 */
export const gotoComposition = async (
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
  await waitForBridge(page);
};

/**
 * Waits for the page to report ready and for web fonts to settle.
 *
 * Must be called after `gotoComposition` (or `openComposition`). Separated so
 * callers can check the composition registry before blocking on readiness.
 */
export const waitForReadyAndFonts = async (page: Page, compositionId?: string): Promise<void> => {
  try {
    await waitForReady(page);
  } catch (error) {
    const label = compositionId ?? "unknown";

    throw new Error(
      `Composition "${label}" never reported ready within ${READY_TIMEOUT_MS}ms at frame 0 — ` +
        "a delayRender() handle is probably still open, or the page failed to load",
      { cause: error },
    );
  }

  await waitForFonts(page);
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
  await gotoComposition(page, url, compositionId, props);
  await waitForReadyAndFonts(page, compositionId);
};

/**
 * True when the page published the composition-registry bridge at all.
 *
 * An empty registry and an un-booted page both look like `[]`, but they are
 * different failures: one is a studio that registered nothing, the other is a
 * bundle that never ran. Only the page can tell them apart.
 */
export const hasCompositionBridge = async (page: Page): Promise<boolean> =>
  await page.evaluate(
    () => typeof (window as unknown as PageBridge).svelteMotion_getCompositions === "function",
  );

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
  // the screenshot below cannot race the previous frame. No `?.()` on the bridge:
  // a missing `setFrame` would make the seek a silent no-op and every frame after
  // the first would be a screenshot of frame 0.
  await page.evaluate(async (target: number) => {
    const bridge = window as unknown as PageBridge;

    if (typeof bridge.svelteMotion_setFrame !== "function") {
      throw new Error(
        `frame ${target}: window.svelteMotion_setFrame is not a function — ` +
          "the composition host never installed its bridge",
      );
    }

    await bridge.svelteMotion_setFrame(target);
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
