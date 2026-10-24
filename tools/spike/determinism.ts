/**
 * M0 determinism gate.
 *
 * The whole thesis of svelte-motion is "a frame is a picture". If two headless
 * runs of the same frame do not produce identical bytes, then nothing downstream —
 * frame-accurate scrubbing, resumable renders, parallel frame capture — is honest.
 *
 * So this script does the cheapest thing that can disprove the thesis:
 *
 * 1. serve the built studio from `vite preview`,
 * 2. screenshot frame 0 and frame 90, twice, in one browser with one context,
 * 3. compare bytes.
 *
 * Runs are separate `page.goto` calls on purpose: a fresh document load is the
 * strictest possible repeat, because it re-evaluates the bundle, re-mounts the
 * composition and re-runs every style computation.
 *
 * Run from the repo root: `bun run tools/spike/determinism.ts`
 */

import { join } from "node:path";
import { CHROMIUM_DETERMINISM_FLAGS } from "@svelte-motion/renderer";
import { chromium, type Page } from "playwright";

const PORT = 4173;
const ORIGIN = `http://localhost:${PORT}`;
const REPO_ROOT = join(import.meta.dir, "..", "..");

const COMPOSITION = "hello-world";
const FRAMES = [0, 90] as const;
const PASSES = 2;
const VIEWPORT = { width: 1920, height: 1080 };
const CLIP = { x: 0, y: 0, width: VIEWPORT.width, height: VIEWPORT.height };

/* -------------------------------------------------------------------------- */
/* helpers                                                                     */
/* -------------------------------------------------------------------------- */

const sha256 = (bytes: Uint8Array): string =>
  new Bun.CryptoHasher("sha256").update(bytes).digest("hex");

const sameBytes = (left: Uint8Array, right: Uint8Array): boolean =>
  left.length === right.length && Buffer.from(left).equals(Buffer.from(right));

/** True once nothing is LISTENing on the port. Uses `lsof`, not `fetch`: a probe
 *  request would keep answering from the server we are trying to confirm dead. */
const portIsFree = async (): Promise<boolean> => {
  const lsof = Bun.spawn(["lsof", "-i", `:${PORT}`, "-sTCP:LISTEN", "-t"], {
    stdout: "pipe",
    stderr: "ignore",
  });

  const output = await new Response(lsof.stdout).text();
  await lsof.exited;

  return output.trim() === "";
};

/* -------------------------------------------------------------------------- */
/* preview server                                                              */
/* -------------------------------------------------------------------------- */

type PreviewServer = { stop: () => Promise<boolean> };

const startPreview = (): PreviewServer => {
  // `setsid` makes `vp` a session leader, so `-pid` addresses the whole group.
  // Killing the direct child alone is not enough: `vp` re-execs, and Vite keeps
  // its own worker — either one left alive keeps the port open.
  const proc = Bun.spawn(
    ["setsid", "vp", "run", "studio#preview", "--", "--port", String(PORT), "--strictPort"],
    {
      cwd: REPO_ROOT,
      stdout: "inherit",
      stderr: "inherit",
      env: { ...process.env },
    },
  );

  const stop = async (): Promise<boolean> => {
    for (const signal of ["SIGTERM", "SIGKILL"] as const) {
      try {
        process.kill(-proc.pid, signal);
      } catch {
        // Already gone — the group leader exits on its own when preview dies.
      }

      try {
        process.kill(proc.pid, signal);
      } catch {
        // Same.
      }

      // Give the group a moment to go away before escalating.
      for (let waited = 0; waited < 2000; waited += 100) {
        if (await portIsFree()) {
          await proc.exited;
          return true;
        }

        await Bun.sleep(100);
      }
    }

    return await portIsFree();
  };

  return { stop };
};

const waitForServer = async (): Promise<void> => {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${ORIGIN}/`);

      if (response.ok) {
        return;
      }
    } catch {
      // Not listening yet.
    }

    await Bun.sleep(200);
  }

  throw new Error(`preview server did not answer on ${ORIGIN} within 30s`);
};

/* -------------------------------------------------------------------------- */
/* capture                                                                     */
/* -------------------------------------------------------------------------- */

const capture = async (page: Page, frame: number): Promise<Uint8Array> => {
  const url = `${ORIGIN}/render?composition=${COMPOSITION}&frame=${frame}`;
  await page.goto(url, { waitUntil: "load" });

  // `svelteMotion_ready` is installed by MotionRoot; absent means the host has
  // not mounted yet, so `?.()` returning `undefined` correctly keeps us waiting.
  await page.waitForFunction(
    () => {
      const bridge = window as unknown as { svelteMotion_ready?: () => boolean };

      return bridge.svelteMotion_ready?.() === true;
    },
    undefined,
    { timeout: 30_000 },
  );

  // Drive the frame through the documented bridge. Its await matters: it resolves
  // only after Svelte flushed and the browser painted, so the screenshot cannot
  // catch the previous frame. The extra double-rAF covers the shell's own paint
  // after mount, and `document.fonts.ready` covers text metrics.
  await page.evaluate(async (target: number) => {
    const bridge = window as unknown as {
      svelteMotion_setFrame?: (frame: number) => Promise<void>;
    };

    await bridge.svelteMotion_setFrame?.(target);
    await document.fonts.ready;
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          resolve();
        });
      });
    });
  }, frame);

  return await page.screenshot({ clip: CLIP, type: "png" });
};

/* -------------------------------------------------------------------------- */
/* run                                                                         */
/* -------------------------------------------------------------------------- */

const failures: string[] = [];

const main = async (): Promise<number> => {
  // A leftover server on the port would be screenshotted instead of the fresh
  // build, and the gate would pass against the wrong artifact.
  if (!(await portIsFree())) {
    console.error(`M0 FAIL — port ${PORT} is already in use before the run`);
    return 1;
  }

  const server = startPreview();

  try {
    await waitForServer();

    const browser = await chromium.launch({
      headless: true,
      // The renderer's own list, not a copy: two lists drift, and then this gate
      // measures a browser nobody renders with.
      args: [...CHROMIUM_DETERMINISM_FLAGS],
    });

    try {
      const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
      const page = await context.newPage();

      const shots: Uint8Array[][] = [];

      for (let pass = 0; pass < PASSES; pass++) {
        const frames: Uint8Array[] = [];

        for (const frame of FRAMES) {
          frames.push(await capture(page, frame));
        }

        shots.push(frames);
      }

      for (let pass = 0; pass < PASSES; pass++) {
        for (const [index, frame] of FRAMES.entries()) {
          const bytes = shots[pass]![index]!;
          console.log(
            `pass ${pass + 1} frame ${frame} sha256=${sha256(bytes)} (${bytes.length} bytes)`,
          );
        }
      }

      for (const [index, frame] of FRAMES.entries()) {
        if (!sameBytes(shots[0]![index]!, shots[1]![index]!)) {
          failures.push(
            `frame ${frame} differs between pass 1 and pass 2 ` +
              `(${sha256(shots[0]![index]!)} !== ${sha256(shots[1]![index]!)})`,
          );
        }
      }

      if (sameBytes(shots[0]![0]!, shots[0]![1]!)) {
        failures.push(`frame ${FRAMES[0]} and frame ${FRAMES[1]} are identical — nothing animated`);
      }

      // Gate 3: an unknown id must not blow up; it must name the ids that exist.
      await page.goto(`${ORIGIN}/render?composition=nope`, { waitUntil: "load" });
      await page.waitForFunction(
        (id) => document.querySelector("main")?.textContent?.includes(id) === true,
        COMPOSITION,
        { timeout: 30_000 },
      );

      // `main`, not `body`: the SPA fallback's inline bootstrap script lives in the
      // body too, and its source would drown the page's own text.
      const unknownPageText = await page.evaluate(() =>
        (document.querySelector("main")?.textContent ?? "").replaceAll(/\s+/g, " ").trim(),
      );
      console.log(`unknown-composition page: ${unknownPageText}`);

      await context.close();
    } finally {
      await browser.close();
    }
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  } finally {
    if (!(await server.stop())) {
      failures.push(`something is still listening on port ${PORT} after the run`);
    } else {
      console.log(`port ${PORT} free after the run`);
    }
  }

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(`M0 FAIL — ${failure}`);
    }

    return 1;
  }

  console.log("M0 PASS");
  return 0;
};

process.exit(await main());
