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
import { renderComposition, serveBuild } from "../src/index.ts";
import { installBunShim } from "./bun-shim.ts";

/* Three levels up from `packages/renderer/tests/` — the repo root. */
const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const BUILD_DIR = join(REPO_ROOT, "apps", "studio", "build");

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
  const index = Bun.file(join(BUILD_DIR, "index.html"));

  if (!(await index.exists())) {
    throw new Error(`no studio build at ${BUILD_DIR} — run \`vp run studio#build\` first`);
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

        expect(result).toEqual({
          frameCount: EXPECTED_FRAMES,
          fps: 30,
          width: 1920,
          height: 1080,
          durationInFrames: EXPECTED_FRAMES,
          out: first,
        });

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
});
