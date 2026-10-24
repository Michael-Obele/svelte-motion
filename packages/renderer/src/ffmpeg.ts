/**
 * FFmpeg encoding.
 *
 * Frames arrive as PNGs in memory, so the encoder never touches the filesystem:
 * they go into FFmpeg's stdin through `image2pipe` and come out as an MP4. That
 * keeps a render independent of a scratch directory and saves writing thousands
 * of intermediate files.
 */

/** How to encode the PNG sequence. */
export type EncodeOptions = {
  /** Destination path of the MP4. */
  out: string;
  /** Frames per second of the source sequence. */
  fps: number;
  /** H.264 quality — lower is better. Remotion's default is 18. */
  crf?: number;
  /** Video codec name passed to `-c:v`. */
  codec?: string;
  /** Encoder speed/size tradeoff passed to `-preset`. */
  preset?: string;
};

/** How much of FFmpeg's stderr survives into an error message. */
const STDERR_TAIL = 2_000;

/**
 * Builds the FFmpeg argv for a PNG sequence on stdin.
 *
 * The order is load-bearing, in two places:
 *
 * - `-framerate` must come **before** `-i pipe:0`, alongside `-f image2pipe`.
 *   It is an *input* option; placed after the input FFmpeg accepts it silently
 *   and ignores it, and `image2pipe` falls back to 25 fps — measured on ffmpeg
 *   6.1.1, 90 frames at 30 fps then encode to 3.6 s instead of 3.0 s. The task
 *   brief listed it after `-i`; this is the one deliberate correction.
 * - `-map_metadata -1 -fflags +bitexact -flags:v +bitexact` make the muxer stop
 *   stamping `creation_time` and encoder version into the container. Without that
 *   trio, two renders of the same frames produce different bytes and the
 *   determinism gate is unsatisfiable.
 */
export const buildFfmpegArgs = (options: EncodeOptions): string[] => {
  const { out, fps, crf = 18, codec = "libx264", preset = "medium" } = options;

  return [
    "-y",
    "-framerate",
    String(fps),
    "-f",
    "image2pipe",
    "-vcodec",
    "png",
    "-i",
    "pipe:0",
    "-c:v",
    codec,
    "-pix_fmt",
    "yuv420p",
    "-crf",
    String(crf),
    "-preset",
    preset,
    "-map_metadata",
    "-1",
    "-fflags",
    "+bitexact",
    "-flags:v",
    "+bitexact",
    out,
  ];
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

/**
 * Encodes PNG frames into `options.out`.
 *
 * Frames are written in array order, and that order is the video: this function
 * does no sorting, so callers must hand over frames 0..N in sequence.
 *
 * @throws When FFmpeg exits non-zero, with the tail of its stderr
 */
export const encodeWithFFmpeg = async (
  frames: readonly Uint8Array[],
  options: EncodeOptions,
): Promise<void> => {
  if (frames.length === 0) {
    throw new Error("encodeWithFFmpeg() needs at least one frame");
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

  try {
    for (const frame of frames) {
      // Awaited so backpressure is respected: the sink reports a promise when its
      // buffer is full, and ignoring it would queue the whole render in memory.
      await proc.stdin.write(frame);
      // Flush per frame — the sink buffers, and holding a whole render in the sink
      // would defeat streaming.
      await proc.stdin.flush();
    }

    await proc.stdin.end();
  } catch (error) {
    proc.kill();
    throw error;
  }

  const exitCode = await proc.exited;
  const stderr = await stderrText;

  if (exitCode !== 0) {
    throw new Error(`ffmpeg exited with code ${exitCode}: ${stderr.slice(-STDERR_TAIL).trim()}`);
  }
};
