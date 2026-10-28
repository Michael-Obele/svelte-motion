/**
 * Renderer unit tests — no browser, no build directory, no MP4.
 *
 * The modules are Bun-native by decision (`Bun.serve`, `Bun.spawn`, `Bun.file`),
 * but this suite runs under Node: `vp test` starts Vitest on Node 24, where `Bun`
 * does not exist. Rather than fork the shipped code into a Node path that would
 * never ship, the suite installs the shared shim from `./bun-shim.ts` when — and
 * only when — the real global is missing.
 *
 * The shim is a test harness, not production code: the shipped modules still
 * contain no `child_process` import, and under Bun these same tests hit
 * `Bun.spawn` directly. What the FFmpeg tests exercise is the part that can be
 * wrong anyway — argument order, write order, stdin close, exit code, stderr tail
 * — against the real `ffmpeg` binary on this machine.
 */

import { EventEmitter } from "node:events";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Page } from "playwright";
import { afterAll, beforeAll, describe, expect, test } from "vite-plus/test";
import {
  buildFfmpegArgs,
  captureFrame,
  checkFfmpeg,
  encodeWithFFmpeg,
  inferOutputFormat,
  monitorPageErrors,
  serveBuild,
  waitForReady,
} from "../src/index.ts";
import { installBunShim } from "./bun-shim.ts";

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
    const preset = args.indexOf("-preset");
    const metadata = indexOfSequence(args, ["-map_metadata", "-1"]);
    const fflags = indexOfSequence(args, ["-fflags", "+bitexact"]);
    const flagsV = indexOfSequence(args, ["-flags:v", "+bitexact"]);

    expect(preset).toBeGreaterThan(-1);
    expect(metadata).toBeGreaterThan(preset);
    expect(fflags).toBeGreaterThan(metadata);
    expect(flagsV).toBeGreaterThan(fflags);
    // The output path must stay last: an option after it is an output option for a
    // second file, or is ignored outright.
    expect(args.length - 1).toBeGreaterThan(flagsV);
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

describe("format selection", () => {
  test("reads the format off the output extension", () => {
    expect(inferOutputFormat("out/a.mp4")).toBe("mp4");
    expect(inferOutputFormat("out/a.MOV")).toBe("mp4");
    expect(inferOutputFormat("out/a.mkv")).toBe("mp4");
    expect(inferOutputFormat("out/a.webm")).toBe("webm");
    expect(inferOutputFormat("out/a.gif")).toBe("gif");
  });

  test("names the extensions it does support when handed one it does not", () => {
    // Failing here beats FFmpeg's "Unable to find a suitable output format" after
    // a full render has already captured every frame.
    expect(() => inferOutputFormat("out/a.png")).toThrow(/\.mp4/);
  });

  test("lets an explicit format override the extension", () => {
    const args = buildFfmpegArgs({ out: "out/a.mp4", fps: 30, format: "gif" });

    expect(args).toContain("-vf");
    expect(args.at(-1)).toBe("out/a.mp4");
  });

  test("separates an output name that starts with a dash from the options", () => {
    // Without the separator ffmpeg reads `-y.mp4` as a flag and the render dies
    // at the last step. `--` ends option parsing; verified against ffmpeg 6.1.1.
    const args = buildFfmpegArgs({ out: "-y.mp4", fps: 30 });

    expect(args.slice(-2)).toEqual(["--", "-y.mp4"]);
  });
});

describe("bounded page waits", () => {
  test("a seek that never settles times out naming the frame", async () => {
    const page = {
      evaluate: () => new Promise<never>(() => {}),
      screenshot: async () => new Uint8Array(),
    } as unknown as Page;

    await expect(captureFrame(page, 7, { width: 16, height: 16 }, 50, "stuck")).rejects.toThrow(
      /frame 7 seek did not finish within 50ms/,
    );
  });

  test("a page error rejects a pending readiness wait without burning the timeout", async () => {
    const emitter = new EventEmitter();
    const page = Object.assign(emitter, {
      waitForFunction: () => new Promise<never>(() => {}),
      evaluate: () => new Promise<never>(() => {}),
    }) as unknown as Page;
    monitorPageErrors(page, "broken");

    const started = performance.now();
    const ready = waitForReady(page, 30_000, "broken", 5);

    emitter.emit("pageerror", new Error("boom"));

    await expect(ready).rejects.toThrow(/page error: boom/);
    expect(performance.now() - started).toBeLessThan(1_000);
  });
});

describe("serveBuild containment and fallback", () => {
  const makeSite = async (): Promise<{ root: string; outside: string; parent: string }> => {
    const parent = await makeTempDir();
    const root = join(parent, "build");
    const outside = join(parent, "outside");

    await mkdir(root);
    await mkdir(outside);
    await writeFile(join(root, "index.html"), "<!doctype html><title>spa</title>");

    return { parent, root, outside };
  };

  test("does not serve a symlink that escapes the build directory", async () => {
    const { root, outside } = await makeSite();
    const secret = "escaped-secret";
    await writeFile(join(outside, "secret.txt"), secret);
    await symlink(join(outside, "secret.txt"), join(root, "leak.txt"));

    const server = await serveBuild(root, 0);

    try {
      const response = await fetch(`${server.url}/leak.txt`);

      expect(response.status).toBe(404);
      expect(await response.text()).not.toContain(secret);
    } finally {
      server.stop();
    }
  });

  test("returns 404 for a missing asset but the SPA shell for a navigation", async () => {
    const { root } = await makeSite();
    const server = await serveBuild(root, 0);

    try {
      const asset = await fetch(`${server.url}/missing.png`);
      expect(asset.status).toBe(404);

      const navigation = await fetch(`${server.url}/render`, {
        headers: { accept: "text/html" },
      });
      expect(navigation.status).toBe(200);
      expect(await navigation.text()).toContain("spa");

      // An extensionless fetch is not a navigation, so it must not get HTML.
      const fetchRoute = await fetch(`${server.url}/render`);
      expect(fetchRoute.status).toBe(404);
    } finally {
      server.stop();
    }
  });
});

describe("gif encoding", () => {
  const args = buildFfmpegArgs({ out: "out/banner.gif", fps: 30, width: 1280 });
  const filter = args[args.indexOf("-vf") + 1];

  test("samples, splits, and maps the frames onto a palette built from them", () => {
    expect(filter).toContain("split[palette][frames]");
    expect(filter.indexOf("palettegen")).toBeGreaterThan(-1);
    expect(filter.indexOf("paletteuse")).toBeGreaterThan(filter.indexOf("palettegen"));
    // Chains are `;`-separated: a comma would feed palettegen from split's output
    // instead of from the labelled stream, and ffmpeg rejects the graph.
    expect(filter.split(";")).toHaveLength(3);
  });

  test("drops frames to 15fps and leaves the video-only options out", () => {
    expect(filter.startsWith("fps=15,")).toBe(true);
    // `-crf`, `-pix_fmt` and `-preset` belong to the video encoders; passing them
    // here only earns a "has not been used for any stream" warning per render.
    expect(args).not.toContain("-crf");
    expect(args).not.toContain("-pix_fmt");
    expect(args).not.toContain("-preset");
  });

  test("loops forever and keeps the output path last", () => {
    expect(indexOfSequence(args, ["-loop", "0"])).toBeGreaterThan(-1);
    expect(indexOfSequence(args, ["-framerate", "30"])).toBeLessThan(args.indexOf("-i"));
    expect(args.at(-1)).toBe("out/banner.gif");
  });

  test("never upscales a composition narrower than the ceiling", () => {
    const narrow = buildFfmpegArgs({ out: "a.gif", fps: 30, width: 640 });

    expect(narrow[narrow.indexOf("-vf") + 1]).toContain("scale=640:");
  });

  test("honours explicit colours, rate and width", () => {
    const custom = buildFfmpegArgs({
      out: "a.gif",
      fps: 60,
      width: 1920,
      gif: { maxColors: 32, fps: 10, width: 800 },
    });
    const customFilter = custom[custom.indexOf("-vf") + 1];

    expect(customFilter.startsWith("fps=10,")).toBe(true);
    expect(customFilter).toContain("scale=800:");
    expect(customFilter).toContain("max_colors=32");
  });
});

describe("webm encoding", () => {
  test("writes VP9 in constant-quality mode, with no H.264 preset", () => {
    const args = buildFfmpegArgs({ out: "a.webm", fps: 30 });

    expect(indexOfSequence(args, ["-c:v", "libvpx-vp9"])).toBeGreaterThan(-1);
    // Without `-b:v 0` libvpx treats `-crf` as a ceiling on a bitrate target.
    expect(indexOfSequence(args, ["-b:v", "0"])).toBeGreaterThan(-1);
    expect(indexOfSequence(args, ["-crf", "32"])).toBeGreaterThan(-1);
    expect(args).not.toContain("-preset");
    expect(indexOfSequence(args, ["-fflags", "+bitexact"])).toBeGreaterThan(-1);
  });
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

      const out = join(dir, "garbage.mp4");

      await expect(encodeWithFFmpeg([bogus], { out, fps: 30 })).rejects.toThrow(
        /ffmpeg exited with code/,
      );
      // A failed encode must not leave a partial container behind.
      expect(await Bun.file(out).exists()).toBe(false);
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

  test("a failing frame source stops the encoder and removes the partial output", async () => {
    const dir = await makeTempDir();
    const frame = await makePngFrame(dir);
    const out = join(dir, "partial.mp4");

    async function* failingFrames(): AsyncGenerator<Uint8Array> {
      yield frame;
      throw new Error("capture exploded");
    }

    await expect(encodeWithFFmpeg(failingFrames(), { out, fps: 30 })).rejects.toThrow(
      /capture exploded/,
    );
    expect(await Bun.file(out).exists()).toBe(false);
  });

  test("aborting awaits the encoder exit and removes the partial output", async () => {
    const dir = await makeTempDir();
    const frame = await makePngFrame(dir);
    const out = join(dir, "aborted.mp4");
    const controller = new AbortController();

    async function* framesUntilAborted(): AsyncGenerator<Uint8Array> {
      yield frame;
      controller.abort();
      yield frame;
    }

    await expect(
      encodeWithFFmpeg(framesUntilAborted(), { out, fps: 30 }, controller.signal),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(await Bun.file(out).exists()).toBe(false);
  });

  test("writes a real GIF when the destination says so", async () => {
    const dir = await makeTempDir();
    const frame = await makePngFrame(dir);
    const out = join(dir, "animated.gif");

    // No `format` here on purpose: the extension is the whole API.
    await encodeWithFFmpeg([frame, frame, frame, frame], { out, fps: 30 });

    const bytes = new Uint8Array(await Bun.file(out).arrayBuffer());

    // "GIF89a" — the header, not a promise that the file is pretty.
    expect(new TextDecoder().decode(bytes.slice(0, 6))).toBe("GIF89a");
  });
});

/**
 * One real PNG, produced by ffmpeg itself so the test carries no binary fixture
 * and cannot drift from a base64 blob somebody pasted once.
 */
const makePngFrame = async (dir: string): Promise<Uint8Array> => {
  const out = join(dir, "frame.png");
  const proc = Bun.spawn(
    [
      "ffmpeg",
      "-y",
      "-loglevel",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=c=0x6366f1:s=16x16:d=1",
      "-frames:v",
      "1",
      out,
    ],
    { stdin: "ignore", stdout: "ignore", stderr: "ignore" },
  );

  await proc.exited;

  return new Uint8Array(await Bun.file(out).arrayBuffer());
};
