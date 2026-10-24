/**
 * Player/render pixel parity — real Bun, real browser.
 *
 * Serves the built studio, captures frame 30 of `hello-world` through the
 * render host (`captureFrame`) and through the player host (`/player` at the
 * same frame, paused), then requires the two PNGs to be byte-identical.
 *
 * Prints `PLAYER PARITY PASS` or `FAIL` with the first differing byte, and
 * writes both PNGs to `/tmp/svelte-motion-parity-{a,b}.png` on mismatch.
 * Exits 0 on pass, 1 on fail. Nothing is left running.
 */

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { captureFrame, launchBrowser, openComposition, serveBuild } from "@svelte-motion/renderer";

const REPO_ROOT = join(import.meta.dir, "..", "..");
const BUILD_DIR = join(REPO_ROOT, "apps", "studio", "build");

const main = async (): Promise<number> => {
  if (typeof Bun === "undefined") {
    console.error("PLAYER PARITY FAIL — run with Bun: bun run tools/spike/verify-player-parity.ts");
    return 1;
  }
  if (!(await Bun.file(join(BUILD_DIR, "index.html")).exists())) {
    console.error(`PLAYER PARITY FAIL — no build at ${BUILD_DIR} — run vp run studio#build`);
    return 1;
  }

  const server = await serveBuild(BUILD_DIR, 0);
  const browser = await launchBrowser();
  try {
    const size = { width: 1920, height: 1080 };
    const frame = 30;
    const id = "hello-world";

    const ctxA = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
    let pngA: Uint8Array;
    try {
      const pageA = await ctxA.newPage();
      await openComposition(pageA, server.url, id, undefined, 30_000);
      pngA = await captureFrame(pageA, frame, size, 30_000, id);
    } finally {
      await ctxA.close();
    }

    const ctxB = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
    let pngB: Uint8Array;
    try {
      const pageB = await ctxB.newPage();
      await pageB.goto(
        `${server.url}/player?composition=${encodeURIComponent(id)}&frame=${frame}`,
        {
          waitUntil: "load",
        },
      );
      await pageB.waitForFunction(
        () =>
          (window as unknown as { svelteMotion_ready?: () => boolean }).svelteMotion_ready?.() ===
          true,
        undefined,
        { timeout: 30_000 },
      );
      await pageB.evaluate(async () => {
        await document.fonts.ready;
      });
      await pageB.evaluate(() => new Promise<void>((r) => requestAnimationFrame(() => r())));
      pngB = new Uint8Array(await pageB.screenshot({ clip: { x: 0, y: 0, ...size }, type: "png" }));
    } finally {
      await ctxB.close();
    }

    if (pngA.length !== pngB.length || Buffer.compare(Buffer.from(pngA), Buffer.from(pngB)) !== 0) {
      let firstDiff = -1;
      const len = Math.min(pngA.length, pngB.length);
      for (let i = 0; i < len; i += 1)
        if (pngA[i] !== pngB[i]) {
          firstDiff = i;
          break;
        }
      if (firstDiff === -1 && pngA.length !== pngB.length) firstDiff = len;
      await writeFile("/tmp/svelte-motion-parity-a.png", pngA);
      await writeFile("/tmp/svelte-motion-parity-b.png", pngB);
      console.error(
        `PLAYER PARITY FAIL — render ${pngA.length} bytes, player ${pngB.length} bytes, first diff at ${firstDiff}`,
      );
      console.error("wrote /tmp/svelte-motion-parity-a.png and /tmp/svelte-motion-parity-b.png");
      return 1;
    }

    console.log(`PLAYER PARITY PASS — ${pngA.length} bytes at frame ${frame}, byte-identical`);
    return 0;
  } catch (error) {
    console.error(`PLAYER PARITY FAIL — ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  } finally {
    await browser.close();
    server.stop();
  }
};

process.exit(await main());
