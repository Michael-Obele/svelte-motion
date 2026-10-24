#!/usr/bin/env bun
/**
 * svelte-motion CLI: render and list commands.
 *
 * Bun-native, stdlib-only parsing via `node:util` parseArgs. No new runtime
 * deps, no @svelte-motion/core import. Every server/browser is torn down in
 * finally; nothing listens after any run. Expected failures print `error: …`
 * once and exit 1; stack only when SM_DEBUG=1.
 */

import { parseArgs } from "node:util";
import { resolve } from "node:path";
import {
  getCompositionsFromPage,
  launchBrowser,
  renderComposition,
  serveBuild,
} from "@svelte-motion/renderer";

// ---------------------------------------------------------------------------
// help text
// ---------------------------------------------------------------------------

const HELP_GENERAL = `svelte-motion: render Svelte compositions to video

Usage: svelte-motion <command> [options]

Commands:
  list    List available compositions
  render  Render a composition to video

Options:
  --help, -h         Show help
  --build <dir>      Build directory (default: build, try --build apps/studio/build in this monorepo)

Examples:
  svelte-motion list --build apps/studio/build
  svelte-motion render hello-world --out out/hello-world.mp4 --build apps/studio/build

Run svelte-motion <command> --help for command-specific help.
`;

const HELP_LIST = `svelte-motion list: list available compositions

Usage: svelte-motion list [--build <dir>] [--json]

Options:
  --build <dir>      Build directory (default: build, try --build apps/studio/build in this monorepo)
  --json             Output as JSON
  --help, -h         Show help

Examples:
  svelte-motion list --build apps/studio/build
  svelte-motion list --json --build apps/studio/build
`;

const HELP_RENDER = `svelte-motion render: render a composition to video

Usage: svelte-motion render <id> --out <file> [options]

Arguments:
  <id>               Composition id (e.g. hello-world)

Options:
  --out <file>       Output file (required)
  --build <dir>      Build directory (default: build, try --build apps/studio/build in this monorepo)
  --props <json>     Props as JSON string
  --concurrency <n>  Parallel chunks (default: 1)
  --crf <n>          H.264 quality (default: 18)
  --codec <str>      Video codec (default: libx264)
  --preset <str>     Encoder preset (default: medium)
  --port <n>         Server port (default: 0, OS-assigned)
  --help, -h         Show help

Examples:
  svelte-motion render hello-world --out out/hello-world.mp4 --build apps/studio/build
  svelte-motion render hello-world --out out.mp4 --props '{"title":"Hi"}' --concurrency 2 --build apps/studio/build
`;

function helpFor(topic?: string): string {
  if (topic === "list") return HELP_LIST;
  if (topic === "render") return HELP_RENDER;
  return HELP_GENERAL;
}

// ---------------------------------------------------------------------------
// command types
// ---------------------------------------------------------------------------

export type HelpCommand = { kind: "help"; topic?: "render" | "list" };
export type ListCommand = { kind: "list"; build: string; json: boolean };
export type RenderCommand = {
  kind: "render";
  compositionId: string;
  out: string;
  build: string;
  props?: Record<string, unknown>;
  concurrency?: number;
  crf?: number;
  codec?: string;
  preset?: string;
  port: number;
};
export type Command = HelpCommand | ListCommand | RenderCommand;
export type CliError = { kind: "error"; message: string };

// ---------------------------------------------------------------------------
// parsing
// ---------------------------------------------------------------------------

export function parseCliArgs(argv: string[]): Command | CliError {
  if (argv.length === 0) {
    return { kind: "error", message: `No command provided.\n${HELP_GENERAL}` };
  }

  const hasHelp = argv.includes("--help") || argv.includes("-h");

  if (hasHelp) {
    const first = argv[0];
    if (first === "list" || first === "render") {
      return { kind: "help", topic: first as "render" | "list" };
    }
    if (argv.includes("list")) return { kind: "help", topic: "list" };
    if (argv.includes("render")) return { kind: "help", topic: "render" };
    return { kind: "help" };
  }

  const command = argv[0];

  if (command === "--help" || command === "-h") {
    return { kind: "help" };
  }

  if (command === "list") {
    try {
      const { values, positionals } = parseArgs({
        args: argv.slice(1),
        options: {
          build: { type: "string" },
          json: { type: "boolean" },
          help: { type: "boolean" },
          h: { type: "boolean" },
        },
        allowPositionals: true,
        strict: true,
      });

      if (values.help === true || values.h === true) {
        return { kind: "help", topic: "list" };
      }

      if (positionals.length > 0) {
        return {
          kind: "error",
          message: `Unknown argument for list: ${positionals.join(" ")}\n${HELP_LIST}`,
        };
      }

      const build = (values.build as string | undefined) ?? "build";
      const json = (values.json as boolean | undefined) ?? false;

      return { kind: "list", build, json };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { kind: "error", message: `${message}\n${HELP_LIST}` };
    }
  }

  if (command === "render") {
    try {
      const { values, positionals } = parseArgs({
        args: argv.slice(1),
        options: {
          out: { type: "string" },
          build: { type: "string" },
          props: { type: "string" },
          concurrency: { type: "string" },
          crf: { type: "string" },
          codec: { type: "string" },
          preset: { type: "string" },
          port: { type: "string" },
          help: { type: "boolean" },
          h: { type: "boolean" },
        },
        allowPositionals: true,
        strict: true,
      });

      if (values.help === true || values.h === true) {
        return { kind: "help", topic: "render" };
      }

      if (positionals.length === 0) {
        return {
          kind: "error",
          message: `Missing composition id for render.\n${HELP_RENDER}`,
        };
      }

      if (positionals.length > 1) {
        return {
          kind: "error",
          message: `Too many arguments for render: ${positionals.join(" ")}\n${HELP_RENDER}`,
        };
      }

      const compositionId = positionals[0]!;

      const out = values.out as string | undefined;

      if (!out) {
        return {
          kind: "error",
          message: `Missing required --out <file> for render.\n${HELP_RENDER}`,
        };
      }

      const build = (values.build as string | undefined) ?? "build";

      let port = 0;

      if (values.port !== undefined) {
        const raw = values.port as string;
        const parsed = Number(raw);

        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 65535) {
          return { kind: "error", message: `Invalid --port "${raw}": must be a number 0-65535` };
        }

        port = Math.floor(parsed);
      }

      let props: Record<string, unknown> | undefined;

      if (values.props !== undefined) {
        const raw = values.props as string;

        try {
          const parsed: unknown = JSON.parse(raw);

          if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {
              kind: "error",
              message: `Invalid --props JSON: must be an object, got ${JSON.stringify(parsed)}`,
            };
          }

          props = parsed as Record<string, unknown>;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          return { kind: "error", message: `Invalid JSON for --props: ${message}` };
        }
      }

      let concurrency: number | undefined;

      if (values.concurrency !== undefined) {
        const raw = values.concurrency as string;
        const parsed = Number(raw);

        if (!Number.isFinite(parsed) || parsed < 1) {
          return {
            kind: "error",
            message: `Invalid --concurrency "${raw}": must be a number >= 1`,
          };
        }

        concurrency = Math.floor(parsed);
      }

      let crf: number | undefined;

      if (values.crf !== undefined) {
        const raw = values.crf as string;
        const parsed = Number(raw);

        if (!Number.isFinite(parsed) || parsed < 0 || parsed > 51) {
          return { kind: "error", message: `Invalid --crf "${raw}": must be a number 0-51` };
        }

        crf = Math.floor(parsed);
      }

      const codec = values.codec as string | undefined;
      const preset = values.preset as string | undefined;

      return {
        kind: "render",
        compositionId,
        out,
        build,
        props,
        concurrency,
        crf,
        codec,
        preset,
        port,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      return { kind: "error", message: `${message}\n${HELP_RENDER}` };
    }
  }

  return { kind: "error", message: `Unknown command "${command}".\n${HELP_GENERAL}` };
}

// ---------------------------------------------------------------------------
// execution
// ---------------------------------------------------------------------------

async function runList(command: ListCommand): Promise<void> {
  const absBuild = resolve(command.build);
  const indexFile = Bun.file(resolve(absBuild, "index.html"));

  if (!(await indexFile.exists())) {
    throw new Error(
      `No build directory at ${absBuild}. Run "vp build" in your SvelteKit app first, or pass --build <dir>.`,
    );
  }

  const server = await serveBuild(absBuild, 0);

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
        const target = `${origin}/render?frame=0`;
        await page.goto(target, { waitUntil: "load" });

        try {
          await page.waitForFunction(
            () =>
              typeof (window as unknown as { svelteMotion_getCompositions?: unknown })
                .svelteMotion_getCompositions === "function",
            { timeout: 5000 },
          );
        } catch {
          // Bridge may already be there or may never appear, getCompositions will tell
        }

        const compositions = await getCompositionsFromPage(page);

        if (command.json) {
          console.log(JSON.stringify(compositions, null, 2));
        } else {
          if (compositions.length === 0) {
            console.log("No compositions found.");
          } else {
            for (const composition of compositions) {
              const size = `${composition.width}x${composition.height}`;
              const line = `${composition.id}  ${size}  ${composition.fps}fps  ${composition.durationInFrames} frames`;
              console.log(line);
            }
          }
        }
      } finally {
        await context.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    server.stop();
  }
}

async function runRender(command: RenderCommand): Promise<void> {
  const absBuild = resolve(command.build);
  const indexFile = Bun.file(resolve(absBuild, "index.html"));

  if (!(await indexFile.exists())) {
    throw new Error(
      `No build directory at ${absBuild}. Run "vp build" in your SvelteKit app first, or pass --build <dir>.`,
    );
  }

  let lastProgress = 0;

  const onProgress = (done: number, total: number): void => {
    if (done % 10 === 0 || done === total) {
      process.stdout.write(`\rrendered ${done}/${total}`);
      lastProgress = done;
      if (done === total) {
        process.stdout.write("\n");
      }
    }
  };

  const result = await renderComposition({
    buildDir: absBuild,
    compositionId: command.compositionId,
    out: command.out,
    props: command.props,
    concurrency: command.concurrency,
    crf: command.crf,
    codec: command.codec,
    preset: command.preset,
    port: command.port,
    onProgress,
  });

  if (lastProgress !== result.frameCount) {
    process.stdout.write("\n");
  }

  const seconds = (result.durationInFrames / result.fps).toFixed(1);
  console.log(
    `${command.compositionId} → ${command.out} (${result.frameCount} frames, ${result.width}x${result.height} @ ${result.fps}fps, ${seconds}s)`,
  );

  for (const warning of result.warnings) {
    console.error(`warning: ${warning}`);
  }
}

export async function main(argv: string[]): Promise<void> {
  const parsed = parseCliArgs(argv);

  if (parsed.kind === "error") {
    console.error(`error: ${parsed.message}`);
    if (process.env.SM_DEBUG === "1" && parsed.message) {
      console.error(new Error(parsed.message).stack);
    }
    process.exitCode = 1;
    return;
  }

  if (parsed.kind === "help") {
    console.log(helpFor(parsed.topic));
    process.exitCode = 0;
    return;
  }

  try {
    if (parsed.kind === "list") {
      await runList(parsed);
    } else if (parsed.kind === "render") {
      await runRender(parsed);
    }
    process.exitCode = 0;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`error: ${message}`);
    if (process.env.SM_DEBUG === "1" && error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exitCode = 1;
  }
}

if (import.meta.main) {
  await main(process.argv.slice(2));
}
