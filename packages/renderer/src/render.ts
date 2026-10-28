/**
 * The frame loop.
 *
 * This is the piece that turns "a frame is a picture" into a file: serve the
 * built studio, drive headless Chromium to every frame number, stream the PNGs
 * to FFmpeg on stdin, and encode.
 *
 * Three decisions are load-bearing and easy to undo by accident:
 *
 * 1. **Absolute frame slots.** Chunks finish out of order, so captured frames go
 *    into a `Map<number, Uint8Array>` reorder buffer and the encoder consumes
 *    `0..n-1` in ascending order. Pushing into an array as frames arrive would
 *    scramble the video; holding the whole map until capture finishes would make
 *    memory scale with the video length.
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
  DEFAULT_READY_TIMEOUT_MS,
  getCompositionsFromPage,
  gotoComposition,
  hasCompositionBridge,
  launchBrowser,
  monitorPageErrors,
  openComposition,
  waitForReadyAndFonts,
  type PageComposition,
  type PageErrorMonitor,
} from "./browser.ts";
import { chunkRange } from "./chunks.ts";
import {
  checkFfmpeg,
  encodeWithFFmpeg,
  inferOutputFormat,
  resolveGifFps,
  type GifOptions,
  type OutputFormat,
} from "./ffmpeg.ts";
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
  /**
   * Destination path. Its extension chooses the format — `.mp4`/`.mov`/`.mkv`
   * for H.264, `.webm` for VP9, `.gif` for an animated GIF. Parent directories
   * must already exist.
   */
  out: string;
  /**
   * How many chunks render in parallel. Defaults to `1`; every extra chunk costs
   * another browser context, a document load and a GPU-less raster of its own.
   */
  concurrency?: number;
  /** Quality passed to FFmpeg — lower is better. H.264 defaults to 18, VP9 to 32. */
  crf?: number;
  /** Video codec name passed to FFmpeg. Defaults to `libx264`, or VP9 for WebM. */
  codec?: string;
  /** Encoder speed/size tradeoff passed to FFmpeg. MP4 only. Defaults to `medium`. */
  preset?: string;
  /** Forces a format instead of inferring it from `out`'s extension. */
  format?: OutputFormat;
  /** GIF tuning. Ignored unless the format is GIF; caps width at 1280 and fps at 15. */
  gif?: GifOptions;
  /** Called after each captured frame with the running and expected totals. */
  onProgress?: (done: number, total: number) => void;
  /**
   * Cancels the render. Checked before each captured frame; aborting throws an
   * error whose `name` is `AbortError`, and the browser and server are still
   * torn down in `finally`.
   */
  signal?: AbortSignal;
  /** How long to wait for readiness before failing. Defaults to 30_000. */
  readyTimeoutMs?: number;
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
  /** Format that was written; GIF and WebM drop frames, the rest match `fps`. */
  format: OutputFormat;
  /** Frame rate actually written to the file. A GIF is capped, so this can be below `fps`. */
  outputFps: number;
  /** Warnings collected from `[svelte-motion]` console messages, deduped, capped at 50. */
  warnings: string[];
  /** Time in ms spent waiting for readiness (probe + first frame). */
  readyMs: number;
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

const invalidCompositionProps = (compositionId: string, message: string): Error =>
  new Error(`Composition "${compositionId}" props are invalid: ${message}`);

/**
 * Reads the registry and returns the config for `compositionId`.
 *
 * Navigates without waiting for readiness, checks the registry immediately so a
 * typo fails in milliseconds rather than after the 30 s ready timeout, then
 * validates props and waits for readiness only when the id is known. The error-page
 * path (unknown id still publishes the registry) is the reason the registry is
 * consulted before the ready wait.
 */
const resolveComposition = async (
  browser: Browser,
  url: string,
  options: RenderOptions,
): Promise<PageComposition> => {
  const readyTimeoutMs = options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS;
  const context = await browser.newContext({
    viewport: PROBE_VIEWPORT,
    deviceScaleFactor: 1,
  });

  try {
    const page = await context.newPage();
    const monitor = monitorPageErrors(page, options.compositionId);
    const find = (compositions: readonly PageComposition[]): PageComposition | undefined =>
      compositions.find((composition) => composition.id === options.compositionId);

    // Navigate without blocking on readiness — a typo should not cost 30 s.
    await gotoComposition(page, url, options.compositionId, options.props);

    // The probe is the first page to see a broken host. Surface its error before
    // interpreting an empty registry as "nothing registered".
    const probeError = monitor.firstError();

    if (probeError !== undefined) {
      throw probeError;
    }

    // Check the registry before waiting: unknown ids fail instantly.
    const available = await getCompositionsFromPage(page);
    const readError = monitor.firstError();

    if (readError !== undefined) {
      throw readError;
    }

    if (available.length === 0 && !(await hasCompositionBridge(page))) {
      throw pageNeverBooted(options.buildDir, url);
    }

    const config = find(available);

    if (config === undefined) {
      throw unknownComposition(options.compositionId, options.buildDir, available);
    }

    // Props validation — must happen before the ready wait so a schema error
    // fails fast and does not look like a readiness timeout.
    const validationError = await page.evaluate(() => {
      const bridge = window as unknown as {
        svelteMotion_validationError?: unknown;
      };
      return bridge.svelteMotion_validationError;
    });

    if (typeof validationError === "string" && validationError.length > 0) {
      throw invalidCompositionProps(options.compositionId, validationError);
    }

    // Id is known — now pay the ready wait. A failure here is a real readiness
    // problem, not a typo, so it surfaces as-is.
    await waitForReadyAndFonts(page, options.compositionId, readyTimeoutMs);

    return config;
  } finally {
    await context.close();
  }
};

/**
 * Renders one composition to a video file or an animated image.
 *
 * @param options - Build directory, composition id, destination and encoder knobs
 * @returns Frame count, dimensions and the output path
 * @throws When ffmpeg is missing, the output format cannot be determined, the id
 *   is unknown, a frame never becomes ready, or FFmpeg fails — always after the
 *   browser and server are torn down
 */
export const renderComposition = async (options: RenderOptions): Promise<RenderResult> => {
  // Resolving the format first means a destination FFmpeg cannot write fails in
  // milliseconds, instead of after a full render has captured every frame.
  const format = options.format ?? inferOutputFormat(options.out);

  if (!(await checkFfmpeg())) {
    throw new Error(MISSING_FFMPEG_MESSAGE);
  }

  const concurrency = normalizeConcurrency(options.concurrency);
  const readyTimeoutMs = options.readyTimeoutMs ?? DEFAULT_READY_TIMEOUT_MS;
  const server = await serveBuild(options.buildDir, options.port ?? 0);

  // Warnings collected from every page; deduped and capped at 50.
  const warnings: string[] = [];
  const warningsSet = new Set<string>();
  const monitors: PageErrorMonitor[] = [];

  const attachDiagnostics = (page: import("playwright").Page, compositionId: string): void => {
    monitors.push(monitorPageErrors(page, compositionId));
    page.on("console", (msg) => {
      const text = msg.text();
      if (text.startsWith("[svelte-motion]")) {
        if (!warningsSet.has(text) && warnings.length < 50) {
          warningsSet.add(text);
          warnings.push(text);
        }
      }
    });
  };

  const checkPageError = (): void => {
    for (const monitor of monitors) {
      const error = monitor.firstError();

      if (error !== undefined) {
        throw error;
      }
    }
  };

  const readyStart = performance.now();

  try {
    const browser = await launchBrowser();

    try {
      const config = await resolveComposition(browser, server.url, options);
      checkPageError();
      const readyMsProbe = Math.round(performance.now() - readyStart);
      const total = config.durationInFrames;
      const size = { width: config.width, height: config.height };

      const assertNotAborted = (internal?: AbortSignal): void => {
        if (options.signal?.aborted === true || internal?.aborted === true) {
          const aborted = new Error(`Render of "${config.id}" was cancelled`);
          aborted.name = "AbortError";
          throw aborted;
        }
      };

      const encodeOptions = {
        out: options.out,
        fps: config.fps,
        crf: options.crf,
        codec: options.codec,
        preset: options.preset,
        format,
        gif: options.gif,
        // The GIF branch caps its own width; it needs the source size to know
        // whether "1280" would upscale a narrower composition.
        width: config.width,
      };

      /*
       * Two capture strategies, chosen by concurrency. Both stream to FFmpeg;
       * neither waits for the last frame before writing the first.
       *
       * `concurrency === 1` is the simple path: one page, frames captured and
       * pushed in order, so peak memory is one PNG.
       *
       * Higher concurrency has chunks finishing out of order. A bounded reorder
       * buffer holds early frames until their turn, and the generator deletes
       * each one as FFmpeg consumes it. The window is what keeps one fast chunk
       * from buffering the rest of the video.
       */
      let frameCount: number;

      if (concurrency === 1) {
        let done = 0;

        async function* sequentialFrames(): AsyncGenerator<Uint8Array> {
          const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });

          try {
            const page = await context.newPage();
            attachDiagnostics(page, config.id);
            await openComposition(page, server.url, config.id, options.props, readyTimeoutMs);
            checkPageError();

            for (let frame = 0; frame < total; frame += 1) {
              assertNotAborted();
              const png = await captureFrame(page, frame, size, readyTimeoutMs, config.id);
              checkPageError();
              done += 1;
              options.onProgress?.(done, total);
              yield png;
            }
          } finally {
            await context.close();
          }
        }

        await encodeWithFFmpeg(sequentialFrames(), encodeOptions, options.signal);
        frameCount = total;
      } else {
        // Keyed by absolute frame: chunk completion order is an implementation
        // detail that must not reach the encoder.
        const buffered = new Map<number, Uint8Array>();
        const waiters: Array<() => void> = [];
        const wake = (): void => {
          for (const resolve of waiters.splice(0)) {
            resolve();
          }
        };
        const waitUntil = async (condition: () => boolean): Promise<void> => {
          while (!condition()) {
            await new Promise<void>((resolve) => waiters.push(resolve));
          }
        };

        // Total frames waiting for their turn. This is a count, not a distance:
        // chunks may finish far out of order, but never buffer more than this
        // many PNGs. Without the cap a chunk that wins the race could hold the
        // whole video.
        const maxBuffered = Math.max(4, concurrency * 8);
        let nextFrame = 0;
        let done = 0;

        // Internal cancellation: a failed worker or encoder stops the other side
        // instead of letting it keep capturing frames nobody will encode.
        const cancel = new AbortController();
        const forwardAbort = (): void => {
          cancel.abort();
          wake();
        };
        options.signal?.addEventListener("abort", forwardAbort, { once: true });

        let workerFailure: unknown;
        let encoderFailure: unknown;

        const workers = Promise.all(
          chunkRange(0, total, concurrency).map(async (chunk) => {
            const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });

            try {
              const page = await context.newPage();
              attachDiagnostics(page, config.id);
              await openComposition(page, server.url, config.id, options.props, readyTimeoutMs);
              assertNotAborted(cancel.signal);
              checkPageError();

              for (let frame = chunk.start; frame < chunk.end; frame += 1) {
                assertNotAborted(cancel.signal);
                // Always let the worker that owns `nextFrame` through, even when
                // the buffer is full: it is the only one that can unblock the
                // encoder, so blocking it would deadlock every worker.
                await waitUntil(
                  () => cancel.signal.aborted || frame === nextFrame || buffered.size < maxBuffered,
                );
                assertNotAborted(cancel.signal);

                const png = await captureFrame(page, frame, size, readyTimeoutMs, config.id);
                assertNotAborted(cancel.signal);
                checkPageError();
                buffered.set(frame, png);
                done += 1;
                options.onProgress?.(done, total);
                wake();
              }
            } finally {
              await context.close();
            }
          }),
        ).catch((error: unknown) => {
          workerFailure = error;
          cancel.abort();
          wake();
          throw error;
        });

        async function* orderedFrames(): AsyncGenerator<Uint8Array> {
          for (let frame = 0; frame < total; frame += 1) {
            await waitUntil(() => buffered.has(frame) || cancel.signal.aborted);
            assertNotAborted(cancel.signal);

            const png = buffered.get(frame);

            if (png === undefined) {
              throw new Error(`Frame ${frame} of "${config.id}" was never captured`);
            }

            // Released before the yield: once FFmpeg has the bytes there is no
            // reason to keep the PNG alive.
            buffered.delete(frame);
            nextFrame = frame + 1;
            wake();
            yield png;
          }
        }

        const encoder = encodeWithFFmpeg(orderedFrames(), encodeOptions, cancel.signal).catch(
          (error: unknown) => {
            encoderFailure = error;
            cancel.abort();
            wake();
            throw error;
          },
        );

        const results = await Promise.allSettled([workers, encoder]);
        options.signal?.removeEventListener("abort", forwardAbort);

        // A cancellation-driven AbortError is the symptom, not the cause: when
        // one side really failed, report that instead of "aborted".
        const failures = [workerFailure, encoderFailure].filter(
          (failure): failure is Error => failure instanceof Error && failure.name !== "AbortError",
        );
        const rejected = results.find(
          (result): result is PromiseRejectedResult => result.status === "rejected",
        );
        const failure = failures[0] ?? rejected?.reason;

        if (failure !== undefined) {
          throw failure;
        }

        checkPageError();
        frameCount = total;
      }

      checkPageError();

      return {
        frameCount: frameCount,
        fps: config.fps,
        width: config.width,
        height: config.height,
        durationInFrames: config.durationInFrames,
        out: options.out,
        format,
        outputFps: format === "gif" ? resolveGifFps(encodeOptions) : config.fps,
        warnings: [...warnings],
        readyMs: readyMsProbe,
      };
    } finally {
      await browser.close();
    }
  } finally {
    // Safe on every path: `stop()` never throws and closes keep-alive sockets too.
    server.stop();
  }
};
