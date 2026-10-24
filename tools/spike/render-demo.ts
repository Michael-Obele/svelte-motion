/**
 * Render demo — the smallest thing that proves the pipeline works outside a test.
 *
 * Serves `apps/studio/build`, renders `hello-world` through the real frame loop
 * and writes `out/hello-world.mp4`. Run it with `vp run render-demo`; it expects
 * the studio to be built already (`vp run studio#build`).
 *
 * It imports `packages/renderer/src` directly rather than the workspace package,
 * because the package entry point is `dist/` — a demo that needs a build first is
 * a demo that fails for the wrong reason.
 */

import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { renderComposition } from "../../packages/renderer/src/index.ts";

const REPO_ROOT = join(import.meta.dir, "..", "..");
const BUILD_DIR = join(REPO_ROOT, "apps", "studio", "build");
const OUT = join(REPO_ROOT, "out", "hello-world.mp4");

/** Every tenth frame plus the last one: enough to show progress, not enough to spam. */
const PROGRESS_STEP = 10;

const main = async (): Promise<void> => {
  await mkdir(dirname(OUT), { recursive: true });

  const startedAt = performance.now();
  const result = await renderComposition({
    buildDir: BUILD_DIR,
    compositionId: "hello-world",
    out: OUT,
    onProgress: (done, total) => {
      if (done % PROGRESS_STEP === 0 || done === total) {
        console.log(`  ${done}/${total} frames`);
      }
    },
  });

  const seconds = ((performance.now() - startedAt) / 1000).toFixed(1);

  console.log(`\n${result.out}`);
  console.log(
    `${result.frameCount} frames · ${result.width}x${result.height} · ${result.fps} fps · ` +
      `${(result.frameCount / result.fps).toFixed(2)} s · rendered in ${seconds} s`,
  );
};

await main();
