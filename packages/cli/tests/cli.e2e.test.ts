import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vite-plus/test";

const REPO_ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const BUILD_DIR = join(REPO_ROOT, "apps", "studio", "build");
const CLI_SRC = join(REPO_ROOT, "packages", "cli", "src", "index.ts");

const TIMEOUT_MS = 600_000;

beforeAll(async () => {
  // Install Bun shims when running under Vitest/Node (no real Bun)
  if (typeof Bun === "undefined") {
    const { installBunShim } = await import("../../renderer/tests/bun-shim.ts");
    installBunShim();
  }
});

const e2e = test.skipIf(!process.env.SM_E2E);

type SpawnResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
};

const spawnCli = async (args: string[]): Promise<SpawnResult> => {
  const start = performance.now();

  // Use Bun.spawn when available (Bun runtime), else child_process (Vitest/Node)
  if (typeof Bun !== "undefined" && typeof Bun.spawn === "function") {
    const proc = Bun.spawn(["bun", CLI_SRC, ...args], {
      cwd: REPO_ROOT,
      stdout: "pipe",
      stderr: "pipe",
    });
    const stdoutText = new Response(proc.stdout).text();
    const stderrText = new Response(proc.stderr).text();
    const exitCode = await proc.exited;
    const durationMs = performance.now() - start;
    const stdout = await stdoutText;
    const stderr = await stderrText;
    return { exitCode, stdout, stderr, durationMs };
  }

  // Node fallback
  const child = spawn("bun", [CLI_SRC, ...args], {
    cwd: REPO_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let stdout = "";
  let stderr = "";

  child.stdout?.on("data", (chunk: Buffer) => {
    stdout += chunk.toString();
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
  const durationMs = performance.now() - start;
  return { exitCode, stdout, stderr, durationMs };
};

const makeTempDir = async (): Promise<string> =>
  await mkdtemp(join(tmpdir(), "svelte-motion-cli-e2e-"));

const probeVideo = async (file: string): Promise<{ frameCount: number }> => {
  if (typeof Bun !== "undefined" && typeof Bun.spawn === "function") {
    const proc = Bun.spawn(
      [
        "ffprobe",
        "-v",
        "error",
        "-count_frames",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=nb_frames,nb_read_frames",
        "-of",
        "json",
        file,
      ],
      { stdin: "ignore", stdout: "pipe", stderr: "pipe" },
    );
    const stderrText = new Response(proc.stderr).text();
    const stdoutText = new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    const stderr = await stderrText;
    if (exitCode !== 0) {
      throw new Error(`ffprobe exited with code ${exitCode}: ${stderr.trim()}`);
    }
    const parsed = JSON.parse(await stdoutText) as {
      streams?: { nb_frames?: string; nb_read_frames?: string }[];
    };
    const [stream] = parsed.streams ?? [];
    if (stream === undefined) {
      throw new Error(`ffprobe found no video stream in ${file}`);
    }
    return {
      frameCount: Number(stream.nb_read_frames ?? stream.nb_frames ?? Number.NaN),
    };
  }

  const child = spawn("ffprobe", [
    "-v",
    "error",
    "-count_frames",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=nb_frames,nb_read_frames",
    "-of",
    "json",
    file,
  ]);

  let stdout = "";
  let stderr = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    stdout += chunk.toString();
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });
  const exitCode = await new Promise<number>((resolve, reject) => {
    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
  if (exitCode !== 0) {
    throw new Error(`ffprobe exited with code ${exitCode}: ${stderr.trim()}`);
  }
  const parsed = JSON.parse(stdout) as {
    streams?: { nb_frames?: string; nb_read_frames?: string }[];
  };
  const [stream] = parsed.streams ?? [];
  if (stream === undefined) {
    throw new Error(`ffprobe found no video stream in ${file}`);
  }
  return {
    frameCount: Number(stream.nb_read_frames ?? stream.nb_frames ?? Number.NaN),
  };
};

describe("CLI e2e", () => {
  e2e(
    "--help exit 0 + contains render",
    async () => {
      const result = await spawnCli(["--help"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/render/);
      expect(result.stdout).toMatch(/list/);
      expect(result.stdout).toMatch(/Examples:/);
    },
    TIMEOUT_MS,
  );

  e2e(
    "list exit 0 + contains hello-world",
    async () => {
      const result = await spawnCli(["list", "--build", BUILD_DIR]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/hello-world/);
    },
    TIMEOUT_MS,
  );

  e2e(
    "list --json exit 0 + valid JSON",
    async () => {
      const result = await spawnCli(["list", "--build", BUILD_DIR, "--json"]);
      expect(result.exitCode).toBe(0);
      const parsed = JSON.parse(result.stdout) as unknown[];
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed.length).toBeGreaterThan(0);
      const ids = (parsed as { id: string }[]).map((c) => c.id);
      expect(ids).toContain("hello-world");
    },
    TIMEOUT_MS,
  );

  e2e(
    "render hello-world --out produces 90-frame MP4",
    async () => {
      const dir = await makeTempDir();
      const out = join(dir, "out.mp4");

      try {
        const result = await spawnCli([
          "render",
          "hello-world",
          "--out",
          out,
          "--build",
          BUILD_DIR,
        ]);
        expect(result.exitCode).toBe(0);
        expect(result.stdout).toMatch(/hello-world →/);
        expect(result.stdout).toMatch(/90 frames/);
        expect(result.stdout).toMatch(/1920x1080/);
        expect(result.stdout).toMatch(/30fps/);

        const file = Bun.file(out);
        expect(await file.exists()).toBe(true);

        const probe = await probeVideo(out);
        expect(probe.frameCount).toBe(90);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
    TIMEOUT_MS,
  );

  e2e(
    "render unknown id exit 1 + lists ids + completes in < 5s",
    async () => {
      const dir = await makeTempDir();
      const out = join(dir, "unknown.mp4");

      try {
        const result = await spawnCli([
          "render",
          "definitely-not-registered",
          "--out",
          out,
          "--build",
          BUILD_DIR,
        ]);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(/not registered/);
        expect(result.stderr).toMatch(/hello-world/);
        expect(result.durationMs).toBeLessThan(5000);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
    TIMEOUT_MS,
  );

  e2e(
    "render --help exit 0 + contains examples",
    async () => {
      const result = await spawnCli(["render", "--help"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/--out/);
      expect(result.stdout).toMatch(/Examples:/);
      const examples = (result.stdout.match(/svelte-motion render/g) ?? []).length;
      expect(examples).toBeGreaterThanOrEqual(2);
    },
    TIMEOUT_MS,
  );

  e2e(
    "list --help exit 0 + contains examples",
    async () => {
      const result = await spawnCli(["list", "--help"]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/--json/);
      expect(result.stdout).toMatch(/Examples:/);
      const examples = (result.stdout.match(/svelte-motion list/g) ?? []).length;
      expect(examples).toBeGreaterThanOrEqual(2);
    },
    TIMEOUT_MS,
  );

  e2e(
    "render fixture-font-heavy with invalid props exits 1 and names validation issue",
    async () => {
      const dir = await makeTempDir();
      const out = join(dir, "out.mp4");

      try {
        const result = await spawnCli([
          "render",
          "fixture-font-heavy",
          "--out",
          out,
          "--build",
          BUILD_DIR,
          "--props",
          '{"title":""}',
        ]);
        expect(result.exitCode).toBe(1);
        expect(result.stderr).toMatch(/title/i);
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
    TIMEOUT_MS,
  );

  e2e(
    "list includes fixture ids",
    async () => {
      const result = await spawnCli(["list", "--build", BUILD_DIR]);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/fixture-font-heavy/);
      expect(result.stdout).toMatch(/fixture-missing-asset/);
      expect(result.stdout).toMatch(/fixture-stuck/);
    },
    TIMEOUT_MS,
  );
});
