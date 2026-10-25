/**
 * Interactive mode: pick a composition, render it, watch progress, cancel.
 *
 * Loaded only when the CLI is run with no command, so `list` and `render` never
 * pull OpenTUI (or its native Zig core) into a scripted run.
 *
 * ponytail: browse + render + progress + cancel only. Out path, crf and
 * concurrency stay CLI flags — a text field for each is focus-handling code
 * that buys nothing over `--crf 20`. Add an input when someone asks.
 */

import { BoxRenderable, createCliRenderer, TextRenderable } from "@opentui/core";
import {
  getCompositionsFromPage,
  launchBrowser,
  renderComposition,
  serveBuild,
  type PageComposition,
} from "@svelte-motion/renderer";
import { resolve } from "node:path";

/** Read the registry the same way `list` does, then tear everything down. */
const readCompositions = async (buildDir: string): Promise<PageComposition[]> => {
  const server = await serveBuild(buildDir, 0);

  try {
    const browser = await launchBrowser();

    try {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        deviceScaleFactor: 1,
      });

      try {
        const page = await context.newPage();
        const origin = server.url.replace(/\/+$/, "");
        await page.goto(`${origin}/render?frame=0`, { waitUntil: "load" });

        // The bridge appears during hydration, so reading the registry before
        // it exists yields an empty list. `list` waits for the same thing.
        try {
          await page.waitForFunction(
            () =>
              typeof (
                window as unknown as {
                  svelteMotion_getCompositions?: unknown;
                }
              ).svelteMotion_getCompositions === "function",
            { timeout: 5000 },
          );
        } catch {
          // The read below reports the real story if it never appears.
        }

        return await getCompositionsFromPage(page);
      } finally {
        await context.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    server.stop();
  }
};

const seconds = (ms: number): string => `${(ms / 1000).toFixed(1)}s`;

/**
 * Run the interactive renderer.
 *
 * Returns an exit code: `0` after a completed render or a clean quit, `1` when
 * the build directory or composition list is unusable.
 */
export async function runTui(buildDir: string): Promise<number> {
  const absBuild = resolve(buildDir);

  if (!(await Bun.file(resolve(absBuild, "index.html")).exists())) {
    console.error(
      `error: No build directory at ${absBuild}. Run "vp build" in your SvelteKit app first, or pass --build <dir>.`,
    );
    return 1;
  }

  const compositions = await readCompositions(absBuild);

  if (compositions.length === 0) {
    console.error(`error: No compositions registered in ${absBuild}.`);
    return 1;
  }

  const renderer = await createCliRenderer({ exitOnCtrlC: false });

  const column = new BoxRenderable(renderer, {
    flexDirection: "column",
    paddingLeft: 1,
    paddingRight: 1,
    gap: 0,
  });
  renderer.root.add(column);

  const title = new TextRenderable(renderer, { content: "" });
  const list = new TextRenderable(renderer, { content: "" });
  const status = new TextRenderable(renderer, { content: "" });
  const hint = new TextRenderable(renderer, { content: "" });
  column.add(title);
  column.add(list);
  column.add(status);
  column.add(hint);

  let selected = 0;
  let phase: "browse" | "rendering" | "done" | "cancelled" | "failed" = "browse";
  let progress = { done: 0, total: 0 };
  let message = "";
  let startedAt = 0;
  let controller: AbortController | null = null;

  const activeComposition = (): PageComposition | undefined => compositions[selected];

  /**
   * One repaint of every row. Rebuilding the strings is cheaper than diffing,
   * and it means a resize needs no special case: the flexbox re-wraps, the
   * text re-renders.
   */
  const paint = (): void => {
    const composition = activeComposition();

    title.content = `svelte-motion — ${compositions.length} composition${compositions.length === 1 ? "" : "s"}`;

    list.content = compositions
      .map((entry, index) => {
        const marker = index === selected ? "›" : " ";
        const size = `${entry.width}x${entry.height}`;
        return `${marker} ${entry.id}  ${size}  ${entry.fps}fps  ${entry.durationInFrames} frames`;
      })
      .join("\n");

    if (phase === "rendering") {
      const { done, total } = progress;
      const pct = total > 0 ? Math.floor((done / total) * 100) : 0;
      const elapsed = performance.now() - startedAt;
      const eta = done > 0 ? (elapsed / done) * (total - done) : 0;
      const bar = "█".repeat(Math.round(pct / 4)).padEnd(25, "·");
      status.content = `\nrendering ${composition?.id ?? ""}  ${bar} ${pct}%  ${done}/${total}  ${seconds(elapsed)} elapsed  ${seconds(eta)} left`;
    } else if (phase === "done") {
      status.content = `\n${message}`;
    } else if (phase === "cancelled") {
      status.content = `\n${message}`;
    } else if (phase === "failed") {
      status.content = `\n${message}`;
    } else {
      status.content = composition === undefined ? "" : `\nready to render ${composition.id}`;
    }

    hint.content =
      phase === "rendering" ? "\nctrl+c cancel" : "\n↑/↓ select · enter render · q quit";
  };

  const startRender = async (): Promise<void> => {
    const composition = activeComposition();

    if (composition === undefined || phase === "rendering") {
      return;
    }

    phase = "rendering";
    progress = { done: 0, total: composition.durationInFrames };
    startedAt = performance.now();
    controller = new AbortController();
    paint();

    const out = resolve("out", `${composition.id}.mp4`);

    try {
      await Bun.$`mkdir -p ${resolve("out")}`.quiet();

      const result = await renderComposition({
        buildDir: absBuild,
        compositionId: composition.id,
        out,
        signal: controller.signal,
        onProgress: (done, total) => {
          progress = { done, total };
          paint();
        },
      });

      phase = "done";
      message = `${composition.id} → ${result.out}  (${result.frameCount} frames, ${seconds((result.durationInFrames / result.fps) * 1000)})`;
    } catch (error: unknown) {
      const aborted = controller.signal.aborted;
      phase = aborted ? "cancelled" : "failed";
      message = aborted
        ? `cancelled ${composition.id}`
        : `error: ${error instanceof Error ? error.message : String(error)}`;
    } finally {
      controller = null;
      paint();
    }
  };

  renderer.keyInput.on("keypress", (key) => {
    if (phase === "rendering") {
      if (key.ctrl === true && key.name === "c") {
        controller?.abort();
      }

      return;
    }

    if (key.name === "q" || (key.ctrl === true && key.name === "c")) {
      renderer.destroy();
      return;
    }

    if (key.name === "up") {
      selected = (selected - 1 + compositions.length) % compositions.length;
      paint();
      return;
    }

    if (key.name === "down") {
      selected = (selected + 1) % compositions.length;
      paint();
      return;
    }

    if (key.name === "return") {
      void startRender();
    }
  });

  renderer.on("resize", paint);
  paint();

  // No `await` for a quit: the renderer runs until `destroy()`.
  return await new Promise<number>((done) => {
    const originalDestroy = renderer.destroy.bind(renderer);
    renderer.destroy = (): void => {
      originalDestroy();
      const code = process.exitCode;
      done(typeof code === "number" ? code : 0);
    };
  });
}
