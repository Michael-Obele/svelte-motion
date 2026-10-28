/**
 * End-to-end gate — the whole thesis in one test.
 *
 * Everything below is a real run: the built studio served over HTTP, headless
 * Chromium driven frame by frame, PNGs piped into FFmpeg, a real MP4 on disk. It
 * is opt-in (`SM_E2E=1`) because it takes minutes and needs a studio build.
 *
 * What it asserts, and why each one earns its runtime:
 *
 * - **90 frames, h264, yuv420p, ~3.0 s** — the render reached every frame. A
 *   dropped frame here is silent: FFmpeg happily encodes 89 frames at 30 fps and
 *   produces a video that is 33 ms short.
 * - **two renders, identical sha256** — this is the determinism gate, and it is
 *   the one that fails quietly in the real world. It only holds because the font
 *   flags in `launchBrowser()` pin rasterisation and `buildFfmpegArgs()` strips
 *   `creation_time`. If either regresses, the bytes diverge and this test says so.
 * - **unknown id names the available ids** — a typo in a composition id must not
 *   surface as "never reported ready".
 * - **a `.js` asset answers with a JavaScript content type** — the shim's MIME
 *   table and Bun's own must agree, because an ES module served as
 *   `application/octet-stream` is refused by the browser and the render then
 *   fails as a readiness timeout instead of as a server bug.
 */

import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vite-plus/test";
import { captureFrame, renderComposition, serveBuild } from "../src/index.ts";
import { launchBrowser, openComposition } from "../src/index.ts";
import { installBunShim } from "./bun-shim.ts";

/* Three levels up from `packages/renderer/tests/` — the repo root. */
const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const BUILD_DIR = join(REPO_ROOT, "apps", "studio", "build");
/*
 * The examples live in their own app, so they are rendered by `examples/build`.
 * That is deliberate: an example proves itself when the app a user would write can
 * render it, not when a sandbox that knows where the folder is can.
 */
const EXAMPLES_BUILD_DIR = join(REPO_ROOT, "examples", "build");

/** Two renders plus frame capture; the default 5 s would be a bad joke. */
const TIMEOUT_MS = 600_000;

const COMPOSITION_ID = "hello-world";
const EXPECTED_FRAMES = 90;
const EXPECTED_SECONDS = 3;

beforeAll(() => {
  installBunShim();
});

/** `test.skipIf` keeps the suite green on a machine that only wants unit tests. */
const e2e = test.skipIf(!process.env.SM_E2E);

/** Fails with the command that fixes it, not with ENOENT. */
const requireStudioBuild = async (): Promise<void> => {
  await requireBuild(BUILD_DIR);
};

/** Fails with the command that fixes it, not with ENOENT. */
const requireBuild = async (dir: string): Promise<void> => {
  const index = Bun.file(join(dir, "index.html"));

  if (!(await index.exists())) {
    throw new Error(
      `no build at ${dir} — run \`vp run ${dir === BUILD_DIR ? "studio" : "examples"}#build\` first`,
    );
  }
};

const makeTempDir = async (): Promise<string> =>
  await mkdtemp(join(tmpdir(), "svelte-motion-e2e-"));

/** Path of the first `.js` asset in the build, with POSIX separators for a URL. */
const firstJsAsset = async (): Promise<string> => {
  const entries = await readdir(BUILD_DIR, { recursive: true });
  const [asset] = entries.filter((entry) => entry.endsWith(".js")).sort();

  if (asset === undefined) {
    throw new Error(`no .js asset under ${BUILD_DIR} — run \`vp run studio#build\` first`);
  }

  return asset.replaceAll("\\", "/");
};

const sha256 = (bytes: Uint8Array): string =>
  new Bun.CryptoHasher("sha256").update(bytes).digest("hex");

type ProbeStream = {
  codec_name?: string;
  pix_fmt?: string;
  nb_frames?: string;
  nb_read_frames?: string;
};

type Probe = {
  stream: ProbeStream;
  /** Frame count as ffprobe counted it, whichever field carries it. */
  frameCount: number;
  duration: number;
};

/** Reads the container back the way a viewer would. */
const probeVideo = async (file: string): Promise<Probe> => {
  const proc = Bun.spawn(
    [
      "ffprobe",
      "-v",
      "error",
      "-count_frames",
      "-select_streams",
      "v:0",
      "-show_entries",
      "stream=codec_name,pix_fmt,nb_frames,nb_read_frames:format=duration",
      "-of",
      "json",
      file,
    ],
    { stdin: "ignore", stdout: "pipe", stderr: "pipe" },
  );

  // Drain stderr first: a full pipe would block ffprobe while we wait on stdout.
  const stderrText = new Response(proc.stderr).text();
  const stdoutText = new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  const stderr = await stderrText;

  if (exitCode !== 0) {
    throw new Error(`ffprobe exited with code ${exitCode}: ${stderr.trim()}`);
  }

  const parsed = JSON.parse(await stdoutText) as {
    streams?: ProbeStream[];
    format?: { duration?: string };
  };
  const [stream] = parsed.streams ?? [];

  if (stream === undefined) {
    throw new Error(`ffprobe found no video stream in ${file}`);
  }

  return {
    stream,
    frameCount: Number(stream.nb_read_frames ?? stream.nb_frames ?? Number.NaN),
    duration: Number(parsed.format?.duration ?? Number.NaN),
  };
};

describe("renderComposition (e2e)", () => {
  e2e(
    "renders hello-world to a real MP4, twice, byte-identically",
    async () => {
      await requireStudioBuild();

      const dir = await makeTempDir();
      const first = join(dir, "first.mp4");
      const second = join(dir, "second.mp4");

      try {
        const result = await renderComposition({
          buildDir: BUILD_DIR,
          compositionId: COMPOSITION_ID,
          out: first,
        });

        expect(result).toMatchObject({
          frameCount: EXPECTED_FRAMES,
          fps: 30,
          width: 1920,
          height: 1080,
          durationInFrames: EXPECTED_FRAMES,
          out: first,
        });
        expect(result.warnings).toEqual([]);
        expect(typeof result.readyMs).toBe("number");

        const probe = await probeVideo(first);

        expect(probe.stream.codec_name).toBe("h264");
        expect(probe.stream.pix_fmt).toBe("yuv420p");
        expect(probe.frameCount).toBe(EXPECTED_FRAMES);
        // 90 frames at 30 fps. A miss here means `-framerate` moved behind `-i`.
        expect(probe.duration).toBeGreaterThanOrEqual(EXPECTED_SECONDS - 0.1);
        expect(probe.duration).toBeLessThanOrEqual(EXPECTED_SECONDS + 0.1);

        // Second render in a fresh browser, fresh server, fresh temp file.
        await renderComposition({
          buildDir: BUILD_DIR,
          compositionId: COMPOSITION_ID,
          out: second,
        });

        const firstBytes = new Uint8Array(await readFile(first));
        const secondBytes = new Uint8Array(await readFile(second));
        const firstDigest = sha256(firstBytes);
        const secondDigest = sha256(secondBytes);

        // Shaped as an object so a failure prints both digests — "they differ"
        // alone tells nobody which stage broke.
        expect({ sha256: secondDigest }).toEqual({ sha256: firstDigest });
        expect(secondBytes.length).toBe(firstBytes.length);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
    TIMEOUT_MS,
  );

  e2e(
    "serial and parallel capture produce byte-identical MP4s",
    async () => {
      await requireStudioBuild();

      const dir = await makeTempDir();
      const serial = join(dir, "serial.mp4");
      const parallel = join(dir, "parallel.mp4");

      try {
        // One variable: how many browser contexts captured the frames. The
        // parallel path finishes chunks out of order and rebuilds the sequence
        // from absolute frame indices; if that reordering is wrong the file
        // differs even though every frame was captured.
        await renderComposition({
          buildDir: BUILD_DIR,
          compositionId: COMPOSITION_ID,
          out: serial,
          concurrency: 1,
        });
        await renderComposition({
          buildDir: BUILD_DIR,
          compositionId: COMPOSITION_ID,
          out: parallel,
          concurrency: 2,
        });

        const serialBytes = new Uint8Array(await readFile(serial));
        const parallelBytes = new Uint8Array(await readFile(parallel));

        expect({ sha256: sha256(parallelBytes) }).toEqual({ sha256: sha256(serialBytes) });
        expect(parallelBytes.length).toBe(serialBytes.length);
        expect((await probeVideo(parallel)).frameCount).toBe(EXPECTED_FRAMES);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
    TIMEOUT_MS,
  );

  e2e(
    "names the available compositions when the id is unknown",
    async () => {
      await requireStudioBuild();

      const dir = await makeTempDir();

      try {
        const start = performance.now();
        const error = await renderComposition({
          buildDir: BUILD_DIR,
          compositionId: "definitely-not-registered",
          out: join(dir, "unknown.mp4"),
        }).then(
          () => undefined,
          (thrown: unknown) => thrown,
        );
        const elapsed = performance.now() - start;

        expect(error).toBeInstanceOf(Error);

        const message = error instanceof Error ? error.message : "";
        // Both halves are load-bearing: "not registered" is the diagnosis, the
        // available-id list is the fix. A message with only one of them is a
        // different bug, so neither matcher alone is enough.
        expect(message).toMatch(/not registered/);
        expect(message).toMatch(/hello-world/);
        // Unknown id must fail instantly, not after the 30 s ready timeout
        expect(elapsed).toBeLessThan(5000);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
    TIMEOUT_MS,
  );

  e2e(
    "serves a .js chunk with a JavaScript content type",
    async () => {
      await requireStudioBuild();

      const server = await serveBuild(BUILD_DIR, 0);

      try {
        const asset = await firstJsAsset();
        const response = await fetch(`${server.url}/${asset}`);
        const contentType = response.headers.get("content-type") ?? "";

        expect({ asset, status: response.status }).toEqual({ asset, status: 200 });
        // Bun's own MIME table and the test shim's must agree. An ES module
        // served as `application/octet-stream` is refused by the browser.
        expect(contentType).toMatch(/javascript/i);
      } finally {
        server.stop();
      }
    },
    TIMEOUT_MS,
  );

  e2e(
    "fixture-font-heavy renders with no warnings and MP4 exists",
    async () => {
      await requireStudioBuild();

      const dir = await makeTempDir();
      const out = join(dir, "out.mp4");

      try {
        const result = await renderComposition({
          buildDir: BUILD_DIR,
          compositionId: "fixture-font-heavy",
          out,
        });

        expect(result.frameCount).toBe(60);
        expect(result.warnings).toEqual([]);
        expect(typeof result.readyMs).toBe("number");
        expect(result.readyMs).toBeGreaterThanOrEqual(0);

        const file = Bun.file(out);
        expect(await file.exists()).toBe(true);

        // Decode frame 0 instead of measuring the MP4: this scene is static, so
        // H.264 compresses 60 frames into ~12 KB, and container size says
        // nothing about whether a frame has content. A blank 1920x1080 PNG is a
        // few KB; this frame (checker image + 64 px title) is ~36 KB.
        const framePng = join(dir, "frame0.png");
        const extract = Bun.spawn(
          [
            "ffmpeg",
            "-y",
            "-v",
            "error",
            "-i",
            out,
            "-vf",
            "select=eq(n\\,0)",
            "-frames:v",
            "1",
            framePng,
          ],
          { stdout: "ignore", stderr: "pipe" },
        );
        expect(await extract.exited).toBe(0);

        const pngBytes = new Uint8Array(await Bun.file(framePng).arrayBuffer());
        expect(pngBytes.length).toBeGreaterThan(10_000);

        // "Correct font, no fallback flash" is only provable in the DOM: the
        // composition marks itself after `document.fonts.check()` resolves.
        const server = await serveBuild(BUILD_DIR, 0);
        const browser = await launchBrowser();

        try {
          const context = await browser.newContext({
            viewport: { width: 1920, height: 1080 },
            deviceScaleFactor: 1,
          });
          const page = await context.newPage();
          await openComposition(page, server.url, "fixture-font-heavy", undefined, 30_000);

          const fontState = await page.evaluate(() => {
            const title = document.querySelector(".fixture-title");

            return {
              ready: title?.getAttribute("data-font-ready") ?? null,
              family: title === null ? "" : getComputedStyle(title).fontFamily,
            };
          });

          expect(fontState.ready).toBe("true");
          expect(fontState.family).toContain("FixtureFont");
        } finally {
          await browser.close();
          server.stop();
        }

        const probe = await probeVideo(out);
        expect(probe.frameCount).toBe(60);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
    TIMEOUT_MS,
  );

  e2e(
    "fixture-missing-asset renders with one warning and MP4 still exists",
    async () => {
      await requireStudioBuild();

      const dir = await makeTempDir();
      const out = join(dir, "out.mp4");

      try {
        const result = await renderComposition({
          buildDir: BUILD_DIR,
          compositionId: "fixture-missing-asset",
          out,
        });

        expect(result.frameCount).toBe(30);
        expect(result.warnings.length).toBe(1);
        expect(result.warnings[0]).toMatch(/does-not-exist\.png/);

        const file = Bun.file(out);
        expect(await file.exists()).toBe(true);

        const probe = await probeVideo(out);
        expect(probe.frameCount).toBe(30);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
    TIMEOUT_MS,
  );

  e2e(
    "fixture-stuck with readyTimeoutMs 2000 rejects with pending handle label",
    async () => {
      await requireStudioBuild();

      const dir = await makeTempDir();

      try {
        const start = performance.now();
        const error = await renderComposition({
          buildDir: BUILD_DIR,
          compositionId: "fixture-stuck",
          out: join(dir, "out.mp4"),
          readyTimeoutMs: 2000,
        }).then(
          () => undefined,
          (thrown: unknown) => thrown,
        );
        const elapsed = performance.now() - start;

        expect(error).toBeInstanceOf(Error);
        const message = error instanceof Error ? error.message : "";
        expect(message).toMatch(/e2e-stuck-fixture/);
        expect(message).toMatch(/fixture-stuck/);
        expect(message).toMatch(/frame/i);
        expect(elapsed).toBeLessThan(10_000);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
    TIMEOUT_MS,
  );

  e2e(
    "invalid props for fixture-font-heavy rejects with title path",
    async () => {
      await requireStudioBuild();

      const dir = await makeTempDir();

      try {
        const start = performance.now();
        const error = await renderComposition({
          buildDir: BUILD_DIR,
          compositionId: "fixture-font-heavy",
          out: join(dir, "out.mp4"),
          props: { title: 123 as unknown as string },
        }).then(
          () => undefined,
          (thrown: unknown) => thrown,
        );
        const elapsed = performance.now() - start;

        expect(error).toBeInstanceOf(Error);
        const message = error instanceof Error ? error.message : "";
        expect(message).toMatch(/title/);
        expect(elapsed).toBeLessThan(10_000);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
    TIMEOUT_MS,
  );

  e2e(
    "player frame 30 is byte-identical to render frame 30 (M4 parity gate)",
    async () => {
      await requireStudioBuild();

      const { captureFrame, launchBrowser, openComposition } = await import("../src/browser.ts");
      const { writeFile } = await import("node:fs/promises");
      const server = await serveBuild(BUILD_DIR, 0);
      const browser = await launchBrowser();

      try {
        const size = { width: 1920, height: 1080 };
        const frame = 30;
        const compositionId = "hello-world";

        // PNG A: the render host at frame 30, via the existing captureFrame path.
        const contextA = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
        let pngA: Uint8Array;
        try {
          const pageA = await contextA.newPage();
          await openComposition(pageA, server.url, compositionId, undefined, 30_000);
          pngA = await captureFrame(pageA, frame, size, 30_000, compositionId);
        } finally {
          await contextA.close();
        }

        // PNG B: the player host at frame 30, paused, same viewport.
        const contextB = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
        let pngB: Uint8Array;
        try {
          const pageB = await contextB.newPage();
          await pageB.goto(
            server.url +
              "/player?composition=" +
              encodeURIComponent(compositionId) +
              "&frame=" +
              frame,
            { waitUntil: "load" },
          );
          await pageB.waitForFunction(
            () =>
              (
                window as unknown as { svelteMotion_ready?: () => boolean }
              ).svelteMotion_ready?.() === true,
            undefined,
            { timeout: 30_000 },
          );
          await pageB.evaluate(async () => {
            await document.fonts.ready;
          });
          await pageB.evaluate(
            () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())),
          );
          const rawB = await pageB.screenshot({
            clip: { x: 0, y: 0, width: size.width, height: size.height },
            type: "png",
          });
          pngB = new Uint8Array(rawB);
        } finally {
          await contextB.close();
        }

        if (
          pngA.length !== pngB.length ||
          Buffer.compare(Buffer.from(pngA), Buffer.from(pngB)) !== 0
        ) {
          let firstDiff = -1;
          const len = Math.min(pngA.length, pngB.length);
          for (let i = 0; i < len; i += 1) {
            if (pngA[i] !== pngB[i]) {
              firstDiff = i;
              break;
            }
          }
          if (firstDiff === -1 && pngA.length !== pngB.length) firstDiff = len;
          const aPath = "/tmp/svelte-motion-parity-a.png";
          const bPath = "/tmp/svelte-motion-parity-b.png";
          await writeFile(aPath, pngA);
          await writeFile(bPath, pngB);
          throw new Error(
            "Player/render parity failed: PNGs differ — " +
              "render " +
              pngA.length +
              " bytes, player " +
              pngB.length +
              " bytes, " +
              "first differing byte index " +
              firstDiff +
              " — " +
              "wrote " +
              aPath +
              " and " +
              bPath +
              " for inspection",
          );
        }

        expect(Buffer.compare(Buffer.from(pngA), Buffer.from(pngB))).toBe(0);
      } finally {
        await browser.close();
        server.stop();
      }
    },
    TIMEOUT_MS,
  );

  e2e(
    "fixture-video seeks <video> and releases the seeked handle",
    async () => {
      await requireStudioBuild();

      /*
       * A real seekable media file, written into the build directory because the
       * composition host serves assets from there. VP9/WebM rather than H.264:
       * Playwright's Chromium ships the open codecs, not the proprietary ones.
       * `-g 1` makes every frame a keyframe so a seek does not depend on which
       * keyframe precedes it.
       *
       * Nothing is committed: ffmpeg generates the fixture on demand and the
       * `finally` below removes it.
       */
      const videoPath = join(BUILD_DIR, "fixture-video-seek.webm");
      const generated = Bun.spawn(
        [
          "ffmpeg",
          "-y",
          "-loglevel",
          "error",
          "-f",
          "lavfi",
          "-i",
          "testsrc=size=320x240:rate=30:duration=2",
          "-c:v",
          "libvpx-vp9",
          "-b:v",
          "0",
          "-crf",
          "30",
          "-g",
          "1",
          "-an",
          videoPath,
        ],
        { stdin: "ignore", stdout: "ignore", stderr: "pipe" },
      );
      const stderr = await new Response(generated.stderr).text();
      const exitCode = await generated.exited;

      if (exitCode !== 0) {
        throw new Error(`could not generate the video fixture (ffmpeg ${exitCode}): ${stderr}`);
      }

      const size = { width: 1920, height: 1080 };
      const server = await serveBuild(BUILD_DIR, 0);
      const browser = await launchBrowser();

      try {
        const context = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });

        try {
          const page = await context.newPage();
          await openComposition(page, server.url, "fixture-video", undefined, 30_000);

          // Frame 0 is the loaded frame; frame 15 forces a real `currentTime`
          // write. `captureFrame` awaits readiness, and `<Video>` keeps a
          // delayRender handle open from the seek until `seeked` fires — so
          // returning here at all proves the seeked path ran.
          const frame0 = await captureFrame(page, 0, size, 30_000, "fixture-video");
          const frame15 = await captureFrame(page, 15, size, 30_000, "fixture-video");

          // Read the element back: `seeked` firing is not enough if the browser
          // clamped the target. 15 / 30 fps = 0.5 s.
          const currentTime = await page.evaluate(
            () => document.querySelector("video")?.currentTime ?? -1,
          );
          expect(currentTime).toBeCloseTo(0.5, 2);

          // The video is the only animated thing in this composition, so a
          // differing screenshot is proof the pixels followed the seek.
          expect(Buffer.compare(Buffer.from(frame0), Buffer.from(frame15))).not.toBe(0);
        } finally {
          await context.close();
        }
      } finally {
        await browser.close();
        server.stop();
        await rm(videoPath, { force: true });
      }
    },
    TIMEOUT_MS,
  );

  // The examples are the showcase: if one of them stops rendering, the repo is
  // selling something it cannot do. Each is rendered for real, at full length.
  const examples = [
    { id: "title-card", frames: 90 },
    { id: "lower-third", frames: 120 },
    { id: "image-gallery", frames: 120 },
    { id: "data-chart", frames: 150 },
    // Tailwind examples. They also prove the examples app's `@source` directive
    // reaches into `packages/studio-ui`, because none of their utilities exist in
    // that package's own markup.
    { id: "stat-grid", frames: 120 },
    { id: "quote-series", frames: 150 },
    { id: "loop-ticker", frames: 120 },
  ] as const;

  for (const example of examples) {
    e2e(
      `example "${example.id}" renders ${example.frames} frames with no warnings`,
      async () => {
        await requireBuild(EXAMPLES_BUILD_DIR);

        const dir = await makeTempDir();
        const out = join(dir, `${example.id}.mp4`);

        try {
          const result = await renderComposition({
            buildDir: EXAMPLES_BUILD_DIR,
            compositionId: example.id,
            out,
          });

          expect(result.frameCount).toBe(example.frames);
          expect(result.width).toBe(1920);
          expect(result.height).toBe(1080);
          expect(result.fps).toBe(30);
          // A missing asset or a failing fetch would land here, not in a throw.
          expect(result.warnings).toEqual([]);

          const file = Bun.file(out);
          expect(await file.exists()).toBe(true);
          // `stat()` is not part of the Node shim, so read the bytes instead.
          expect((await readFile(out)).length).toBeGreaterThan(1_000);
        } finally {
          await rm(dir, { recursive: true, force: true });
        }
      },
      TIMEOUT_MS,
    );
  }
});
