/**
 * Renderer unit tests — no browser, no build directory, no MP4.
 *
 * The modules are Bun-native by decision (`Bun.serve`, `Bun.spawn`), but this
 * suite runs under Node: `vp test` starts Vitest on Node 24, where `Bun` does not
 * exist. Rather than fork the encoder into a Node path that would never ship, the
 * suite installs a minimal `Bun.spawn` shim backed by `node:child_process` when —
 * and only when — the real global is missing.
 *
 * The shim is a test harness, not production code: the shipped modules still
 * contain no `child_process` import, and under Bun these same tests hit
 * `Bun.spawn` directly. What the FFmpeg tests exercise is the part that can be
 * wrong anyway — argument order, write order, stdin close, exit code, stderr tail
 * — against the real `ffmpeg` binary on this machine.
 */

import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import { buildFfmpegArgs, checkFfmpeg, encodeWithFFmpeg } from "../src/index.ts";

/* -------------------------------------------------------------------------- */
/* Bun.spawn shim (test-only, Node runtime)                                    */
/* -------------------------------------------------------------------------- */

type ShimSpawnOptions = {
  stdin?: "pipe" | "ignore";
  stdout?: "ignore" | "inherit" | "pipe";
  stderr?: "pipe" | "ignore";
};

type ShimProcess = {
  stdin: {
    write: (chunk: Uint8Array) => void;
    flush: () => Promise<void>;
    end: () => Promise<void>;
  };
  exited: Promise<number>;
  stderr: ReadableStream<Uint8Array>;
};

/** Mirrors the sliver of `Bun.spawn` that `ffmpeg.ts` actually uses. */
const spawnShim = (command: readonly string[], options: ShimSpawnOptions): ShimProcess => {
  const [executable, ...args] = command;

  if (executable === undefined) {
    throw new Error("spawnShim() needs a command");
  }

  const child = spawn(executable, args, {
    stdio: [
      options.stdin === "ignore" ? "ignore" : "pipe",
      options.stdout ?? "ignore",
      options.stderr === "ignore" ? "ignore" : "pipe",
    ],
  });

  const childStderr = child.stderr;
  const stderr = new ReadableStream<Uint8Array>({
    start: (controller) => {
      if (childStderr === null) {
        controller.close();

        return;
      }

      childStderr.on("data", (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });
      childStderr.on("end", () => {
        controller.close();
      });
      childStderr.on("error", (error: Error) => {
        controller.error(error);
      });
    },
  });

  const exited = new Promise<number>((resolve, reject) => {
    // Missing binary surfaces here, which is what `checkFfmpeg()` catches.
    child.on("error", reject);
    child.on("close", (code) => {
      resolve(code ?? 1);
    });
  });

  const childStdin = child.stdin;

  return {
    stdin: {
      write: (chunk) => {
        childStdin?.write(chunk);
      },
      flush: async () => {
        if (childStdin === null || !childStdin.writableNeedDrain) {
          return;
        }

        // Real backpressure: without this the frame loop would outrun FFmpeg and
        // buffer the whole render in memory.
        await once(childStdin, "drain");
      },
      end: async () => {
        if (childStdin === null) {
          return;
        }

        await new Promise<void>((resolve) => {
          childStdin.end(resolve);
        });
      },
    },
    exited,
    stderr,
  };
};

const installBunShim = (): void => {
  const target = globalThis as { Bun?: unknown };

  if (target.Bun !== undefined) {
    return;
  }

  target.Bun = { spawn: spawnShim };
};

beforeAll(() => {
  installBunShim();
});

/* -------------------------------------------------------------------------- */
/* argument building                                                           */
/* -------------------------------------------------------------------------- */

/** Index of `sequence` inside `args`, or -1. Used to assert relative order. */
const indexOfSequence = (args: readonly string[], sequence: readonly string[]): number => {
  for (let start = 0; start + sequence.length <= args.length; start += 1) {
    const matches = sequence.every((value, offset) => args[start + offset] === value);

    if (matches) {
      return start;
    }
  }

  return -1;
};

describe("buildFfmpegArgs", () => {
  const args = buildFfmpegArgs({ out: "out/video.mp4", fps: 30 });

  test("overwrites and keeps the output last", () => {
    expect(args[0]).toBe("-y");
    expect(args.at(-1)).toBe("out/video.mp4");
    expect(args.filter((arg) => arg === "out/video.mp4")).toHaveLength(1);
  });

  test("reads a PNG sequence from stdin through the image2pipe demuxer", () => {
    const demuxer = indexOfSequence(args, ["-f", "image2pipe"]);
    const codec = indexOfSequence(args, ["-vcodec", "png"]);
    const input = args.indexOf("-i");

    expect(demuxer).toBeGreaterThan(-1);
    expect(codec).toBeGreaterThan(demuxer);
    expect(input).toBeGreaterThan(codec);
    // The input itself is the pipe — no file glob, no scratch directory.
    expect(args[input + 1]).toBe("pipe:0");
  });

  test("sets the framerate before the input, where ffmpeg honours it", () => {
    // Regression guard: with `-framerate` after `-i pipe:0`, ffmpeg 6.1.1 accepts
    // the option and ignores it, and image2pipe encodes at 25 fps — 90 frames at
    // 30 fps then come out 3.6 s long instead of 3.0 s.
    const framerate = indexOfSequence(args, ["-framerate", "30"]);

    expect(framerate).toBeGreaterThan(-1);
    expect(framerate).toBeLessThan(args.indexOf("-i"));
  });

  test("carries the bitexact trio that makes two renders byte-identical", () => {
    expect(indexOfSequence(args, ["-map_metadata", "-1"])).toBeGreaterThan(-1);
    expect(indexOfSequence(args, ["-fflags", "+bitexact"])).toBeGreaterThan(-1);
    expect(indexOfSequence(args, ["-flags:v", "+bitexact"])).toBeGreaterThan(-1);
  });

  test("defaults to h264, yuv420p, crf 18 and the medium preset", () => {
    expect(indexOfSequence(args, ["-c:v", "libx264"])).toBeGreaterThan(-1);
    expect(indexOfSequence(args, ["-pix_fmt", "yuv420p"])).toBeGreaterThan(-1);
    expect(indexOfSequence(args, ["-crf", "18"])).toBeGreaterThan(-1);
    expect(indexOfSequence(args, ["-preset", "medium"])).toBeGreaterThan(-1);
  });

  test("passes fps, crf, codec and preset through", () => {
    const custom = buildFfmpegArgs({
      out: "custom.mp4",
      fps: 60,
      crf: 23,
      codec: "libvpx-vp9",
      preset: "slow",
    });

    expect(indexOfSequence(custom, ["-framerate", "60"])).toBeGreaterThan(-1);
    expect(indexOfSequence(custom, ["-crf", "23"])).toBeGreaterThan(-1);
    expect(indexOfSequence(custom, ["-c:v", "libvpx-vp9"])).toBeGreaterThan(-1);
    expect(indexOfSequence(custom, ["-preset", "slow"])).toBeGreaterThan(-1);
    expect(custom.at(-1)).toBe("custom.mp4");
  });
});

/* -------------------------------------------------------------------------- */
/* process integration                                                         */
/* -------------------------------------------------------------------------- */

const tempDirs: string[] = [];

const makeTempDir = async (): Promise<string> => {
  const dir = await mkdtemp(join(tmpdir(), "svelte-motion-renderer-"));
  tempDirs.push(dir);

  return dir;
};

afterAll(async () => {
  await Promise.all(tempDirs.map(async (dir) => await rm(dir, { recursive: true, force: true })));
});

describe("checkFfmpeg", () => {
  test("resolves true when ffmpeg is installed", async () => {
    // This box has ffmpeg 6.1.1; a false here means the spawn path is broken, not
    // that the test is environment-sensitive.
    await expect(checkFfmpeg()).resolves.toBe(true);
  });
});

describe("encodeWithFFmpeg", () => {
  test(
    "rejects with the ffmpeg stderr tail when the PNG sequence is garbage",
    async () => {
      const dir = await makeTempDir();

      // A PNG signature followed by noise: ffmpeg starts the demuxer, then fails.
      const bogus = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05,
      ]);

      await expect(
        encodeWithFFmpeg([bogus], { out: join(dir, "garbage.mp4"), fps: 30 }),
      ).rejects.toThrow(/ffmpeg exited with code/);
    },
    // Generous: proves the spawn+stderr path terminates instead of hanging on a
    // half-closed pipe.
    30_000,
  );

  test("rejects an empty frame list before spawning anything", async () => {
    await expect(encodeWithFFmpeg([], { out: "unused.mp4", fps: 30 })).rejects.toThrow(
      /at least one frame/,
    );
  });
});
