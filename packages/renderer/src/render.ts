/**
 * The frame loop.
 *
 * This is the piece that turns "a frame is a picture" into a file: serve the
 * built studio, drive headless Chromium to every frame number, keep the PNGs in
 * memory keyed by their absolute frame, then hand the ordered sequence to FFmpeg
 * on stdin.
 *
 * Three decisions are load-bearing and easy to undo by accident:
 *
 * 1. **Absolute frame slots.** Chunks finish out of order, so the store is a
 *    `Map<number, Uint8Array>` and the encoder receives `0..n-1` rebuilt from it.
 *    Pushing into an array as frames arrive would scramble the video.
 * 2. **One context and page per chunk.** A viewport is context state in
 *    Playwright, and the composition's `width`/`height` is the viewport. Sharing a
 *    page between differently-sized chunks would need a resize per frame.
 * 3. **Nothing outlives the call.** The browser and the build server are closed
 *    in `finally` on *every* path — a thrown capture is the common case, and a
 *    leaked `Bun.serve` keeps the port bound for the rest of the process.
 */

import type { Browser } from "playwright";
import {
  captureFrame,
  getCompositionsFromPage,
  gotoComposition,
  hasCompositionBridge,
  launchBrowser,
  openComposition,
  waitForReadyAndFonts,
  type PageComposition,
} from "./browser.ts";
import { chunkRange } from "./chunks.ts";
import { checkFfmpeg, encodeWithFFmpeg } from "./ffmpeg.ts";
import { serveBuild } from "./serve.ts";

/** Everything one render needs. */
export type RenderOptions = {
  /** Directory holding the built studio (`index.html` + client bundle). */
  buildDir: string;
  /** Port for the build server; `0` (the default) asks the OS for a free one. */
  port?: number;
  /** Registry id of the composition to render, e.g. `hello-world`. */
  compositionId: string;
  /** Props passed through the render URL; omit to use the composition defaults. */
  props?: Record<string, unknown>;
  /** Destination path of the MP4. Parent directories must already exist. */
  out: string;
  /**
   * How many chunks render in parallel. Defaults to `1`; every extra chunk costs
   * another browser context, a document load and a GPU-less raster of its own.
   */
  concurrency?: number;
  /** H.264 quality passed to FFmpeg — lower is better. Defaults to 18. */
  crf?: number;
  /** Video codec name passed to FFmpeg. Defaults to `libx264`. */
  codec?: string;
  /** Encoder speed/size tradeoff passed to FFmpeg. Defaults to `medium`. */
  preset?: string;
  /** Called after each captured frame with the running and expected totals. */
  onProgress?: (done: number, total: number) => void;
};

/** What a render produced. Mirrors the composition, plus where it landed. */
export type RenderResult = {
  /** Frames actually encoded — always `durationInFrames`. */
  frameCount: number;
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  out: string;
};

/** The `apt`/`brew` hint is the difference between a bug report and a fix. */
const MISSING_FFMPEG_MESSAGE =
  "ffmpeg is required to render video but was not found on PATH — install it with " +
  "`apt install ffmpeg` (Debian/Ubuntu) or `brew install ffmpeg` (macOS)";

/** A viewport large enough to mount any composition before its size is known. */
const PROBE_VIEWPORT = { width: 1280, height: 720 } as const;

/** A bad hint must not drop frames: anything unusable collapses to `1`. */
const normalizeConcurrency = (concurrency: number | undefined): number => {
  if (concurrency === undefined || !Number.isFinite(concurrency) || concurrency < 1) {
    return 1;
  }

  return Math.floor(concurrency);
};

const describeAvailable = (compositions: readonly PageComposition[]): string => {
  if (compositions.length === 0) {
    return "none — the studio registered no compositions";
  }

  return compositions.map((composition) => `"${composition.id}"`).join(", ");
};

/**
 * A missing id is a configuration mistake, so the error names the ids that do
 * exist. The alternative — "composition never reported ready" — sends the caller
 * looking for a `delayRender()` bug that is not there.
 */
const unknownComposition = (
  compositionId: string,
  buildDir: string,
  available: readonly PageComposition[],
  cause?: unknown,
): Error =>
  new Error(
    `Composition "${compositionId}" is not registered in ${buildDir}. ` +
      `Available compositions: ${describeAvailable(available)}`,
    cause === undefined ? undefined : { cause },
  );

/**
 * The page published no registry at all, which is a different bug from a typo in
 * the id: the bundle never booted. Reporting this as "not registered" would send
 * the caller to the composition registry instead of to the build.
 */
const pageNeverBooted = (buildDir: string, url: string, cause?: unknown): Error =>
  new Error(
    `The render page at ${url} never published a composition registry ` +
      "(window.svelteMotion_getCompositions is undefined), so it never booted. " +
      `Check that ${buildDir} holds the studio's render host and that its bundle ` +
      "did not throw during load — a composition id cannot be the problem here",
    cause === undefined ? undefined : { cause },
  );

/**
 * Reads the registry and returns the config for `compositionId`.
 *
 * Navigates without waiting for readiness, checks the registry immediately so a
 * typo fails in milliseconds rather than after the 30 s ready timeout, then
 * waits for readiness only when the id is known. The error-page path (unknown
 * id still publishes the registry) is the reason the registry is consulted
 * before the ready wait.
 */
const resolveComposition = async (
  browser: Browser,
  url: string,
  options: RenderOptions,
): Promise<PageComposition> => {
  const context = await browser.newContext({
    viewport: PROBE_VIEWPORT,
    deviceScaleFactor: 1,
  });

  try {
    const page = await context.newPage();
    const find = (compositions: readonly PageComposition[]): PageComposition | undefined =>
      compositions.find((composition) => composition.id === options.compositionId);

    // Navigate without blocking on readiness — a typo should not cost 30 s.
    await gotoComposition(page, url, options.compositionId, options.props);

    // Check the registry before waiting: unknown ids fail instantly.
    const available = await getCompositionsFromPage(page);

    if (available.length === 0 && !(await hasCompositionBridge(page))) {
      throw pageNeverBooted(options.buildDir, url);
    }

    const config = find(available);

    if (config === undefined) {
      throw unknownComposition(options.compositionId, options.buildDir, available);
    }

    // Id is known — now pay the ready wait. A failure here is a real readiness
    // problem, not a typo, so it surfaces as-is.
    await waitForReadyAndFonts(page, options.compositionId);

    return config;
  } finally {
    await context.close();
  }
};

/**
 * Renders one composition to an MP4.
 *
 * @param options - Build directory, composition id, destination and encoder knobs
 * @returns Frame count, dimensions and the output path
 * @throws When ffmpeg is missing, the id is unknown, a frame never becomes ready,
 *   or FFmpeg fails — always after the browser and server are torn down
 */
export const renderComposition = async (options: RenderOptions): Promise<RenderResult> => {
  if (!(await checkFfmpeg())) {
    throw new Error(MISSING_FFMPEG_MESSAGE);
  }

  const concurrency = normalizeConcurrency(options.concurrency);
  const server = await serveBuild(options.buildDir, options.port ?? 0);

  try {
    const browser = await launchBrowser();

    try {
      const config = await resolveComposition(browser, server.url, options);
      const total = config.durationInFrames;
      const size = { width: config.width, height: config.height };

      // Keyed by absolute frame: chunk completion order is an implementation
      // detail that must not reach the encoder.
      const captures = new Map<number, Uint8Array>();
      let done = 0;

      await Promise.all(
        chunkRange(0, total, concurrency).map(async (chunk) => {
          const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });

          try {
            const page = await context.newPage();
            await openComposition(page, server.url, config.id, options.props);

            for (let frame = chunk.start; frame < chunk.end; frame += 1) {
              captures.set(frame, await captureFrame(page, frame, size));
              done += 1;
              options.onProgress?.(done, total);
            }
          } finally {
            await context.close();
          }
        }),
      );

      // Rebuilt in ascending order — this is the video.
      const frames = Array.from({ length: total }, (_, frame) => {
        const png = captures.get(frame);

        if (png === undefined) {
          throw new Error(`Frame ${frame} of "${config.id}" was never captured`);
        }

        return png;
      });

      await encodeWithFFmpeg(frames, {
        out: options.out,
        fps: config.fps,
        crf: options.crf,
        codec: options.codec,
        preset: options.preset,
      });

      return {
        frameCount: frames.length,
        fps: config.fps,
        width: config.width,
        height: config.height,
        durationInFrames: config.durationInFrames,
        out: options.out,
      };
    } finally {
      await browser.close();
    }
  } finally {
    // Safe on every path: `stop()` never throws and closes keep-alive sockets too.
    server.stop();
  }
};
