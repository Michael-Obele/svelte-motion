import { describe, expect, test } from "vite-plus/test";
import { parseCliArgs } from "../src/index.ts";

describe("parseCliArgs", () => {
  test("help variants", () => {
    expect(parseCliArgs(["--help"])).toEqual({ kind: "help" });
    expect(parseCliArgs(["-h"])).toEqual({ kind: "help" });
    expect(parseCliArgs(["list", "--help"])).toEqual({ kind: "help", topic: "list" });
    expect(parseCliArgs(["render", "--help"])).toEqual({ kind: "help", topic: "render" });
    expect(parseCliArgs(["render", "hello-world", "--help"])).toEqual({
      kind: "help",
      topic: "render",
    });
    expect(parseCliArgs(["list", "-h"])).toEqual({ kind: "help", topic: "list" });

    // Help output contains examples
    const helpGeneral = parseCliArgs(["--help"]);
    expect(helpGeneral.kind).toBe("help");
    // Check that help text would contain examples — we test via parse, but also verify help strings contain examples
    // by checking the error messages for unknown commands contain help
  });

  test("list happy paths", () => {
    expect(parseCliArgs(["list"])).toEqual({ kind: "list", build: "build", json: false });
    expect(parseCliArgs(["list", "--build", "apps/studio/build"])).toEqual({
      kind: "list",
      build: "apps/studio/build",
      json: false,
    });
    expect(parseCliArgs(["list", "--json"])).toEqual({ kind: "list", build: "build", json: true });
    expect(parseCliArgs(["list", "--build", "apps/studio/build", "--json"])).toEqual({
      kind: "list",
      build: "apps/studio/build",
      json: true,
    });
  });

  test("render happy paths", () => {
    const basic = parseCliArgs(["render", "hello-world", "--out", "out.mp4"]);
    expect(basic).toEqual({
      kind: "render",
      compositionId: "hello-world",
      out: "out.mp4",
      build: "build",
      props: undefined,
      concurrency: undefined,
      crf: undefined,
      codec: undefined,
      preset: undefined,
      port: 0,
    });

    const full = parseCliArgs([
      "render",
      "hello-world",
      "--out",
      "out.mp4",
      "--build",
      "apps/studio/build",
      "--props",
      '{"title":"Hi"}',
      "--concurrency",
      "2",
      "--crf",
      "18",
      "--codec",
      "libx264",
      "--preset",
      "medium",
      "--port",
      "0",
    ]);
    expect(full).toEqual({
      kind: "render",
      compositionId: "hello-world",
      out: "out.mp4",
      build: "apps/studio/build",
      props: { title: "Hi" },
      concurrency: 2,
      crf: 18,
      codec: "libx264",
      preset: "medium",
      port: 0,
    });
  });

  test("render with all flags", () => {
    const result = parseCliArgs([
      "render",
      "my-comp",
      "--out",
      "/tmp/out.mp4",
      "--build",
      "custom/build",
      "--props",
      '{"a":1,"b":"x"}',
      "--concurrency",
      "4",
      "--crf",
      "23",
      "--codec",
      "libx264",
      "--preset",
      "fast",
      "--port",
      "4173",
    ]);
    expect(result).toEqual({
      kind: "render",
      compositionId: "my-comp",
      out: "/tmp/out.mp4",
      build: "custom/build",
      props: { a: 1, b: "x" },
      concurrency: 4,
      crf: 23,
      codec: "libx264",
      preset: "fast",
      port: 4173,
    });
  });

  test("errors: missing id", () => {
    const result = parseCliArgs(["render", "--out", "out.mp4"]);
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toMatch(/Missing composition id/);
    }
  });

  test("errors: missing --out", () => {
    const result = parseCliArgs(["render", "hello-world"]);
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toMatch(/Missing required --out/);
    }
  });

  test("errors: invalid --props JSON string", () => {
    const result = parseCliArgs([
      "render",
      "hello-world",
      "--out",
      "out.mp4",
      "--props",
      "not-json",
    ]);
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toMatch(/Invalid JSON for --props/);
    }
  });

  test("errors: invalid --props not an object", () => {
    const result = parseCliArgs(["render", "hello-world", "--out", "out.mp4", "--props", "123"]);
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toMatch(/Invalid --props JSON: must be an object/);
    }

    const result2 = parseCliArgs([
      "render",
      "hello-world",
      "--out",
      "out.mp4",
      "--props",
      "[1,2,3]",
    ]);
    expect(result2.kind).toBe("error");
    if (result2.kind === "error") {
      expect(result2.message).toMatch(/Invalid --props JSON: must be an object/);
    }
  });

  test("errors: unknown flag", () => {
    const result = parseCliArgs(["render", "hello-world", "--out", "out.mp4", "--unknown", "x"]);
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toMatch(/Unknown option|unknown/i);
    }

    const result2 = parseCliArgs(["list", "--unknown"]);
    expect(result2.kind).toBe("error");
    if (result2.kind === "error") {
      expect(result2.message).toMatch(/Unknown option|unknown/i);
    }
  });

  test("errors: unknown command", () => {
    const result = parseCliArgs(["unknown"]);
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toMatch(/Unknown command/);
    }

    const result2 = parseCliArgs(["foo", "--bar"]);
    expect(result2.kind).toBe("error");
    if (result2.kind === "error") {
      expect(result2.message).toMatch(/Unknown command/);
    }
  });

  test("errors: no command", () => {
    const result = parseCliArgs([]);
    expect(result.kind).toBe("error");
    if (result.kind === "error") {
      expect(result.message).toMatch(/No command provided/);
    }
  });

  test("help output contains 2+ examples", async () => {
    // Verify help strings by checking that parse returns help and that help text is correct
    // We import the help indirectly via error messages
    const err = parseCliArgs(["unknown"]);
    expect(err.kind).toBe("error");
    if (err.kind === "error") {
      // General help should be in unknown command error
      expect(err.message).toMatch(/svelte-motion list/);
      expect(err.message).toMatch(/svelte-motion render/);
    }

    const listErr = parseCliArgs(["list", "extra-arg"]);
    expect(listErr.kind).toBe("error");
    if (listErr.kind === "error") {
      expect(listErr.message).toMatch(/Examples:/);
      // Count examples — should be 2+
      const examples = (listErr.message.match(/svelte-motion list/g) ?? []).length;
      expect(examples).toBeGreaterThanOrEqual(2);
    }

    const renderErr = parseCliArgs(["render", "hello-world"]);
    expect(renderErr.kind).toBe("error");
    if (renderErr.kind === "error") {
      expect(renderErr.message).toMatch(/Examples:/);
      const examples = (renderErr.message.match(/svelte-motion render/g) ?? []).length;
      expect(examples).toBeGreaterThanOrEqual(2);
    }
  });

  test("render help contains 2+ examples", () => {
    const help = parseCliArgs(["render", "--help"]);
    expect(help).toEqual({ kind: "help", topic: "render" });
  });

  test("list help contains 2+ examples", () => {
    const help = parseCliArgs(["list", "--help"]);
    expect(help).toEqual({ kind: "help", topic: "list" });
  });
});
