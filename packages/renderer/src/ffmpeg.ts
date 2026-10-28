/**
 * FFmpeg encoding.
 *
 * Frames arrive as PNGs in memory, so the encoder never touches the filesystem:
 * they go into FFmpeg's stdin through `image2pipe` and come out as a video or an
 * animated image. That keeps a render independent of a scratch directory and
 * saves writing thousands of intermediate files.
 */

import { rm } from "node:fs/promises";

/** The container families the encoder can write. */
export type OutputFormat = "mp4" | "webm" | "gif";

/**
 * Tuning for `format: "gif"`.
 *
 * A GIF is not a small video — it is an indexed image per frame with no
 * inter-frame prediction, so every knob here trades size against fidelity in a
 * way the video formats do not. The defaults are tuned for flat graphic art
 * (titles, lower thirds, banners); photographic frames want more colours.
 */
export type GifOptions = {
  /** Palette size, 2–256. Flat art is fine at 64; gradients band below ~128. */
  maxColors?: number;
  /** Playback rate. Above ~20 fps the extra frames cost bytes nobody can see. */
  fps?: number;
  /** Output width in pixels; height follows the source aspect ratio. */
  width?: number;
};

/** How to encode the PNG sequence. */
export type EncodeOptions = {
  /** Destination path. Its extension picks the format unless `format` is given. */
  out: string;
  /** Frames per second of the source sequence. */
  fps: number;
  /** Quality knob — lower is better. H.264 defaults to 18, VP9 to 32. Ignored by GIF. */
  crf?: number;
  /** Video codec name passed to `-c:v`, overriding the format's default. */
  codec?: string;
  /** Encoder speed/size tradeoff passed to `-preset`. MP4 only — libvpx has no preset. */
  preset?: string;
  /** Force a container family instead of reading it off `out`'s extension. */
  format?: OutputFormat;
  /** Tuning for the GIF branch; ignored by every other format. */
  gif?: GifOptions;
  /** Pixel width of the frames on stdin, used to cap GIF output. */
  width?: number;
};

/** How much of FFmpeg's stderr survives into an error message. */
const STDERR_TAIL = 2_000;

/**
 * Extensions we recognise, mapped onto the encoder branch that handles them.
 *
 * `.mov` and `.mkv` ride the MP4 branch because H.264 in any of those
 * containers is the same encode; only GIF and WebM need different arguments.
 */
const FORMAT_BY_EXTENSION: Readonly<Record<string, OutputFormat>> = {
  ".mp4": "mp4",
  ".m4v": "mp4",
  ".mov": "mp4",
  ".mkv": "mp4",
  ".webm": "webm",
  ".gif": "gif",
};

/**
 * Reads the format off the output path.
 *
 * @throws When the extension is one we cannot encode — better here, naming the
 * ones we can, than an FFmpeg "Unable to find a suitable output format" after a
 * full render has already captured every frame.
 */
export const inferOutputFormat = (out: string): OutputFormat => {
  const dot = out.lastIndexOf(".");
  const extension = dot === -1 ? "" : out.slice(dot).toLowerCase();
  const format = FORMAT_BY_EXTENSION[extension];

  if (format === undefined) {
    throw new Error(
      `Cannot tell what format "${out}" should be. Use one of ` +
        `${Object.keys(FORMAT_BY_EXTENSION).join(", ")}, or set \`format\` explicitly.`,
    );
  }

  return format;
};

/** GIF caps, applied when `gif` leaves a knob out. */
const GIF_MAX_COLORS = 128;
const GIF_MAX_FPS = 15;
const GIF_MAX_WIDTH = 1280;

/**
 * The rate a GIF will actually run at, after the frame-dropping filter.
 *
 * Exported because the renderer reports what it wrote, and a GIF that quietly
 * plays at 15 fps while the caller is told 30 is the kind of lie that costs an
 * afternoon. Clamped to a whole number because `fps=0` is an FFmpeg error.
 */
export const resolveGifFps = (options: EncodeOptions): number => {
  const fps = options.gif?.fps ?? Math.min(options.fps, GIF_MAX_FPS);

  return Math.max(1, Math.round(fps));
};

/** VP9's default in this encoder. `0` would be lossless and enormous. */
const VP9_CRF = 32;

/**
 * The half of the argv every format shares: read a PNG sequence off stdin.
 *
 * `-framerate` must come **before** `-i pipe:0`, alongside `-f image2pipe`. It
 * is an *input* option; placed after the input FFmpeg accepts it silently and
 * ignores it, and `image2pipe` falls back to 25 fps — measured on ffmpeg 6.1.1,
 * 90 frames at 30 fps then encode to 3.6 s instead of 3.0 s.
 */
const stdinArgs = (fps: number): string[] => [
  "-y",
  "-framerate",
  String(fps),
  "-f",
  "image2pipe",
  "-vcodec",
  "png",
  "-i",
  "pipe:0",
];

/**
 * `-map_metadata -1 -fflags +bitexact -flags:v +bitexact` make the muxer stop
 * stamping `creation_time` and encoder version into the container. Without that
 * trio, two renders of the same frames produce different bytes and the
 * determinism gate is unsatisfiable.
 */
const BITEXACT_ARGS = ["-map_metadata", "-1", "-fflags", "+bitexact", "-flags:v", "+bitexact"];

/**
 * `--` ends FFmpeg's option parsing, so an output called `-y.mp4` is a filename
 * rather than another flag. Verified against ffmpeg 6.1.1: it writes the file
 * and exits 0 with the separator in place.
 */
const outputArgs = (options: EncodeOptions): string[] => ["--", options.out];

/** H.264 in an MP4, MOV or Matroska container. The default and the well-trodden path. */
const buildMp4Args = (options: EncodeOptions): string[] => {
  const { crf = 18, codec = "libx264", preset = "medium" } = options;

  return [
    ...stdinArgs(options.fps),
    "-c:v",
    codec,
    "-pix_fmt",
    "yuv420p",
    "-crf",
    String(crf),
    "-preset",
    preset,
    ...BITEXACT_ARGS,
    ...outputArgs(options),
  ];
};

/**
 * VP9 in WebM — the modern replacement for a GIF: same browser support, a tenth
 * of the bytes, and it keeps soft gradients that a 128-colour palette flattens.
 *
 * Two deliberate differences from the MP4 branch: `-b:v 0` puts libvpx in
 * constant-quality mode (without it `-crf` is only a ceiling on a bitrate), and
 * there is no `-preset` — libvpx takes `-deadline`/`-cpu-used` instead, and
 * passing `-preset` makes FFmpeg print a "has not been used for any stream"
 * warning on every render.
 */
const buildWebmArgs = (options: EncodeOptions): string[] => [
  ...stdinArgs(options.fps),
  "-c:v",
  options.codec ?? "libvpx-vp9",
  "-pix_fmt",
  "yuv420p",
  "-b:v",
  "0",
  "-crf",
  String(options.crf ?? VP9_CRF),
  ...BITEXACT_ARGS,
  ...outputArgs(options),
];

/**
 * The filtergraph that makes a GIF worth looking at.
 *
 * FFmpeg's `gif` encoder, handed no filter, quantises each frame against one
 * implicit palette and the result is both banded and enormous — measured on a
 * 2 s 1280×400 flat-art clip: 11 MB naive versus 2.8 KB through this chain. The
 * chain is the standard two-stage one, collapsed into a single pass (FFmpeg
 * buffers the stream internally) so a render still streams to stdin:
 *
 * 1. `fps` drops source frames. GIF has no inter-frame prediction, so 30 fps
 *    buys nothing over 15 and roughly doubles the file.
 * 2. `scale` caps the width. GIF is a landing-page and chat asset; 1280 is
 *    already generous.
 * 3. `split` feeds the same frames to both halves of the palette step.
 * 4. `palettegen` builds one palette for the whole clip, weighted by how much
 *    each colour differs from its neighbour (`stats_mode=diff`) — that keeps
 *    colours that actually move, which is where banding shows.
 * 5. `paletteuse` maps every frame onto that palette. `dither=none` is correct
 *    for flat art and wrong for photos: dithering a solid field just adds noise
 *    that costs bytes, while a photographic frame needs it to avoid contouring.
 *
 * The chains are separated by `;`, not `,` — a comma continues the *same* chain,
 * and `[palette]palettegen` as a continuation would be fed by `split`'s output
 * rather than by the labelled stream `split` produced.
 *
 * Width and fps are computed here rather than inside the filter as
 * `min(1280,iw)`, because a comma inside a filtergraph expression has to be
 * escaped and that is a trap waiting for the next editor.
 */
const buildGifFilter = (options: EncodeOptions): string => {
  const maxColors = Math.min(Math.max(options.gif?.maxColors ?? GIF_MAX_COLORS, 2), 256);
  const ceiling = options.gif?.width ?? GIF_MAX_WIDTH;
  const width = Math.max(
    1,
    options.width === undefined ? ceiling : Math.min(ceiling, options.width),
  );

  const sample = [
    `fps=${resolveGifFps(options)}`,
    `scale=${width}:-1:flags=lanczos`,
    "split[palette][frames]",
  ].join(",");

  return [
    sample,
    `[palette]palettegen=max_colors=${maxColors}:stats_mode=diff[palette]`,
    "[frames][palette]paletteuse=dither=none",
  ].join(";");
};

/** An animated GIF. `-loop 0` means loop forever, which is what a landing page wants. */
const buildGifArgs = (options: EncodeOptions): string[] => [
  ...stdinArgs(options.fps),
  "-vf",
  buildGifFilter(options),
  "-loop",
  "0",
  ...BITEXACT_ARGS,
  ...outputArgs(options),
];

/**
 * Builds the FFmpeg argv for a PNG sequence on stdin.
 *
 * The format comes from `format`, or from `out`'s extension when it is omitted.
 * Two ordering rules hold across every branch: input options (`-framerate`,
 * `-f`, `-vcodec`) precede `-i`, and the output path is last — an option after
 * it belongs to a second output file, or is ignored.
 */
export const buildFfmpegArgs = (options: EncodeOptions): string[] => {
  switch (options.format ?? inferOutputFormat(options.out)) {
    case "gif": {
      return buildGifArgs(options);
    }
    case "webm": {
      return buildWebmArgs(options);
    }
    case "mp4": {
      return buildMp4Args(options);
    }
  }
};

/** True when `ffmpeg` is on PATH and executable. */
export const checkFfmpeg = async (): Promise<boolean> => {
  try {
    const proc = Bun.spawn(["ffmpeg", "-version"], {
      stdin: "ignore",
      stdout: "ignore",
      stderr: "ignore",
    });

    return (await proc.exited) === 0;
  } catch {
    // `Bun.spawn` throws when the binary is missing (ENOENT) — that is the answer,
    // not an error worth propagating.
    return false;
  }
};

const abortError = (): Error => {
  const error = new Error("ffmpeg encode was cancelled");
  error.name = "AbortError";

  return error;
};

/**
 * Encodes PNG frames into `options.out`.
 *
 * Frames are written in iteration order, and that order is the video: this
 * function does no sorting, so callers must hand over frames 0..N in sequence.
 *
 * Accepts an array or any (async) iterable. The iterable form is what keeps a
 * long render flat in memory: frames reach FFmpeg as they are captured instead
 * of all being held until the last one finishes.
 *
 * @param signal - Stops the frame loop, kills the encoder and waits for it to
 *   exit; a partial output file is removed before the error is thrown
 * @throws When FFmpeg exits non-zero or the write path fails, with the tail of
 *   its stderr
 */
export const encodeWithFFmpeg = async (
  frames: Iterable<Uint8Array> | AsyncIterable<Uint8Array>,
  options: EncodeOptions,
  signal?: AbortSignal,
): Promise<void> => {
  // An empty array is knowable up front, so fail before spawning FFmpeg. An
  // iterable only reveals emptiness after iterating, hence the check after the
  // loop below.
  if (Array.isArray(frames) && frames.length === 0) {
    throw new Error("encodeWithFFmpeg() needs at least one frame");
  }

  // Read through a function: the compiler narrows a direct `signal?.aborted`
  // check, but an AbortSignal can flip at any later moment.
  const isAborted = (): boolean => signal?.aborted === true;

  if (isAborted()) {
    throw abortError();
  }

  const proc = Bun.spawn(["ffmpeg", ...buildFfmpegArgs(options)], {
    stdin: "pipe",
    stdout: "ignore",
    stderr: "pipe",
  });

  // Start draining stderr *before* writing. FFmpeg writes progress to stderr, and
  // a full pipe buffer would block it mid-encode while we block on stdin — a
  // deadlock that looks exactly like a hung render.
  const stderrText = new Response(proc.stderr).text();
  const kill = (): void => {
    try {
      proc.kill();
    } catch {
      // Already gone: waiting on `exited` below is still the right thing to do.
    }
  };
  const onAbort = (): void => kill();

  signal?.addEventListener("abort", onAbort, { once: true });

  let wrote = 0;
  // Wrapping gives the manual `next()` below one iterator type for arrays and
  // async generators alike; `return()` also forwards to the source generator.
  const iterator = (async function* (): AsyncGenerator<Uint8Array> {
    yield* frames;
  })();

  /**
   * `iterator.next()` on its own cannot be cancelled. Racing it with the abort
   * event means an encoder failure or Ctrl+C stops the loop even while the
   * caller is still producing the next frame.
   */
  const nextFrame = async (): Promise<IteratorResult<Uint8Array>> => {
    if (isAborted()) {
      throw abortError();
    }

    if (signal === undefined) {
      return await iterator.next();
    }

    let remove = (): void => {};

    try {
      return await Promise.race([
        iterator.next(),
        new Promise<never>((_, reject) => {
          const onAbortSignal = (): void => reject(abortError());
          signal.addEventListener("abort", onAbortSignal, { once: true });
          remove = () => signal.removeEventListener("abort", onAbortSignal);
        }),
      ]);
    } finally {
      remove();
    }
  };

  try {
    for (;;) {
      const next = await nextFrame();

      if (next.done === true) {
        break;
      }

      const frame = next.value;

      // Awaited so backpressure is respected: the sink reports a promise when its
      // buffer is full, and ignoring it would queue the whole render in memory.
      await proc.stdin.write(frame);
      // Flush per frame — the sink buffers, and holding a whole render in the sink
      // would defeat streaming.
      await proc.stdin.flush();
      wrote += 1;
    }

    if (wrote === 0) {
      throw new Error("encodeWithFFmpeg() needs at least one frame");
    }

    await proc.stdin.end();
  } catch (error) {
    // Best effort: lets the source generator run its `finally` (closing its page)
    // without blocking the error path on a capture that is still in flight.
    void iterator.return(undefined);
    // The iteration above closed the frame generator. Now stop the encoder, wait
    // for it to actually exit, and only then read stderr: a live process can
    // still be flushing the lines that explain the failure.
    kill();
    await proc.exited;
    const stderr = await stderrText.catch(() => "");
    await rm(options.out, { force: true }).catch(() => {});
    const failure = isAborted() ? abortError() : error;
    const reason = failure instanceof Error ? failure.message : String(failure);
    const detail = stderr.slice(-STDERR_TAIL).trim();

    const wrapped = new Error(
      `ffmpeg encode failed after ${wrote} frame${wrote === 1 ? "" : "s"}: ${reason}` +
        (detail.length > 0 ? `\nffmpeg stderr:\n${detail}` : ""),
      { cause: failure },
    );

    if (failure instanceof Error && failure.name === "AbortError") {
      wrapped.name = "AbortError";
    }

    throw wrapped;
  } finally {
    signal?.removeEventListener("abort", onAbort);
  }

  const exitCode = await proc.exited;
  const stderr = await stderrText;

  if (isAborted()) {
    await rm(options.out, { force: true }).catch(() => {});

    throw abortError();
  }

  if (exitCode !== 0) {
    // A failed encode leaves a partial container. Removing it means a caller
    // cannot mistake the broken file for a finished render.
    await rm(options.out, { force: true }).catch(() => {});

    throw new Error(`ffmpeg exited with code ${exitCode}: ${stderr.slice(-STDERR_TAIL).trim()}`);
  }
};
