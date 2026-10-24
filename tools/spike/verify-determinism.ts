/**
 * Real-Bun determinism gate.
 *
 * `packages/renderer/tests/render.e2e.test.ts` proves the pipeline under Vitest on
 * Node, with the Bun globals shimmed. That is a proof about the shim as much as
 * about the renderer: it cannot catch a divergence between `Bun.file`'s MIME
 * handling and the shim's own table, nor between `Bun.spawn`'s stdin semantics and
 * `node:child_process`'s.
 *
 * So this script does the same work under the runtime the renderer actually ships
 * on:
 *
 * 1. render `hello-world` twice through `renderComposition()`, into `/tmp`;
 * 2. read both containers back with `ffprobe` — 90 frames, h264, yuv420p, ~3.0 s;
 * 3. hash both MP4s and require the digests to be equal;
 * 4. fetch one `.js` asset from `serveBuild()` and require a JavaScript
 *    Content-Type.
 *
 * Exits 0 and prints `DETERMINISM PASS` with both digests, or 1 with the reasons.
 * Nothing is left running and the temp directory is removed either way.
 *
 * Run from the repo root: `bun run tools/spike/verify-determinism.ts`, or
 * `vp run verify`, which builds the studio first.
 *
 * The `@svelte-motion/renderer` specifier resolves to `packages/renderer/src`
 * through `tools/spike/tsconfig.json` `paths`, for typecheck *and* for Bun at
 * runtime — the package entry point is `dist/`, and a gate that measures yesterdays
 * build is worse than no gate.
 */

import { mkdir, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { renderComposition, serveBuild } from "@svelte-motion/renderer";

const REPO_ROOT = join(import.meta.dir, "..", "..");
const BUILD_DIR = join(REPO_ROOT, "apps", "studio", "build");
const OUT_DIR = "/tmp/svelte-motion-verify";

const COMPOSITION = "hello-world";
const EXPECTED_FRAMES = 90;
const EXPECTED_SECONDS = 3;
const DURATION_TOLERANCE = 0.1;

const failures: string[] = [];

const fail = (message: string): void => {
  failures.push(message);
};

const sha256 = (bytes: Uint8Array): string =>
  new Bun.CryptoHasher("sha256").update(bytes).digest("hex");

/* -------------------------------------------------------------------------- */
/* container readback                                                          */
/* -------------------------------------------------------------------------- */

type Probe = {
  codec: string;
  pixelFormat: string;
  frames: number;
  duration: number;
};

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

  // Both pipes are drained before the exit code is awaited: a full pipe buffer
  // would block ffprobe while this side waits for it to finish.
  const stderrText = new Response(proc.stderr).text();
  const stdoutText = new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  const stderr = await stderrText;

  if (exitCode !== 0) {
    throw new Error(`ffprobe exited with code ${exitCode}: ${stderr.trim()}`);
  }

  const parsed = JSON.parse(await stdoutText) as {
    streams?: {
      codec_name?: string;
      pix_fmt?: string;
      nb_frames?: string;
      nb_read_frames?: string;
    }[];
    format?: { duration?: string };
  };
  const [stream] = parsed.streams ?? [];

  if (stream === undefined) {
    throw new Error(`ffprobe found no video stream in ${file}`);
  }

  return {
    codec: stream.codec_name ?? "",
    pixelFormat: stream.pix_fmt ?? "",
    // `-count_frames` always writes `nb_read_frames`; `nb_frames` is the header
    // field, which is a lie for some muxers.
    frames: Number(stream.nb_read_frames ?? stream.nb_frames ?? Number.NaN),
    duration: Number(parsed.format?.duration ?? Number.NaN),
  };
};

/**
 * A dropped frame is silent — FFmpeg happily encodes 89 frames at 30 fps and the
 * file is 33 ms short — so the frame count is asserted, not assumed.
 */
const assertContainer = (label: string, probe: Probe): void => {
  if (probe.codec !== "h264") {
    fail(`${label}: codec is "${probe.codec}", expected h264`);
  }

  if (probe.pixelFormat !== "yuv420p") {
    fail(`${label}: pixel format is "${probe.pixelFormat}", expected yuv420p`);
  }

  if (probe.frames !== EXPECTED_FRAMES) {
    fail(`${label}: ${probe.frames} frames, expected ${EXPECTED_FRAMES}`);
  }

  if (Math.abs(probe.duration - EXPECTED_SECONDS) > DURATION_TOLERANCE) {
    fail(
      `${label}: duration ${probe.duration}s, expected ${EXPECTED_SECONDS}s ` +
        `± ${DURATION_TOLERANCE}s`,
    );
  }

  console.log(
    `${label}: ${probe.frames} frames · ${probe.codec}/${probe.pixelFormat} · ` +
      `${probe.duration.toFixed(3)} s`,
  );
};

/* -------------------------------------------------------------------------- */
/* asset Content-Type                                                          */
/* -------------------------------------------------------------------------- */

/** Path of the first `.js` asset in the build, with POSIX separators for a URL. */
const firstJsAsset = async (): Promise<string> => {
  const entries = await readdir(BUILD_DIR, { recursive: true });
  const [asset] = entries.filter((entry) => entry.endsWith(".js")).sort();

  if (asset === undefined) {
    throw new Error(`no .js asset under ${BUILD_DIR}`);
  }

  return asset.replaceAll("\\", "/");
};

/**
 * The check the Vitest suite cannot make honestly.
 *
 * `Bun.file` chooses the Content-Type from the extension; the Node shim keeps its
 * own MIME table. If they disagree, the studio is served as
 * `application/octet-stream`, the browser refuses to evaluate the module, and the
 * render fails as "never reported ready" — a delayRender bug that is really a
 * server bug. Fetching one chunk under the real runtime is the only way to know.
 */
const checkAssetContentType = async (): Promise<void> => {
  const server = await serveBuild(BUILD_DIR, 0);

  try {
    const asset = await firstJsAsset();
    const url = `${server.url}/${asset}`;
    const response = await fetch(url);
    const contentType = response.headers.get("content-type") ?? "";

    console.log(`asset: ${url} → ${response.status} ${contentType}`);

    if (!response.ok) {
      fail(`serving ${asset} answered ${response.status}`);
    } else if (!/javascript/i.test(contentType)) {
      fail(`serving ${asset} answered Content-Type "${contentType}", not a JavaScript type`);
    }
  } finally {
    server.stop();
  }
};

/* -------------------------------------------------------------------------- */
/* run                                                                         */
/* -------------------------------------------------------------------------- */

const main = async (): Promise<number> => {
  // No shim here on purpose: the whole point of this script is the real runtime.
  if (typeof Bun === "undefined") {
    console.error(
      "DETERMINISM FAIL — run this with Bun: bun run tools/spike/verify-determinism.ts",
    );

    return 1;
  }

  if (!(await Bun.file(join(BUILD_DIR, "index.html")).exists())) {
    console.error(
      `DETERMINISM FAIL — no studio build at ${BUILD_DIR} — run \`vp run studio#build\` first`,
    );

    return 1;
  }

  const first = join(OUT_DIR, "first.mp4");
  const second = join(OUT_DIR, "second.mp4");
  let digests: { first: string; second: string } | undefined;

  try {
    // A stale MP4 from an earlier run must not be mistaken for this one's output.
    await rm(OUT_DIR, { recursive: true, force: true });
    await mkdir(OUT_DIR, { recursive: true });

    for (const [label, out] of [
      ["first", first],
      ["second", second],
    ] as const) {
      const startedAt = performance.now();
      const result = await renderComposition({
        buildDir: BUILD_DIR,
        compositionId: COMPOSITION,
        out,
      });
      const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);

      console.log(
        `${label} render: ${result.frameCount} frames · ${result.width}x${result.height} · ` +
          `${result.fps} fps · ${seconds} s`,
      );

      assertContainer(label, await probeVideo(out));
    }

    const firstDigest = sha256(new Uint8Array(await readFile(first)));
    const secondDigest = sha256(new Uint8Array(await readFile(second)));
    digests = { first: firstDigest, second: secondDigest };

    if (firstDigest !== secondDigest) {
      fail(`the two renders differ: ${firstDigest} !== ${secondDigest}`);
    }

    await checkAssetContentType();
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  } finally {
    // Nothing survives this script: no MP4s, no server, no browser. Each render
    // stops its own server and browser in its own `finally`.
    const removed = await rm(OUT_DIR, { recursive: true, force: true }).then(
      () => true,
      () => false,
    );

    if (!removed) {
      console.warn(`warning: could not remove ${OUT_DIR}`);
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`DETERMINISM FAIL — ${failure}`);
    }

    return 1;
  }

  console.log("");
  console.log("DETERMINISM PASS");
  console.log(`  ${first}  sha256=${digests?.first ?? "?"}`);
  console.log(`  ${second}  sha256=${digests?.second ?? "?"}`);

  return 0;
};

process.exit(await main());
