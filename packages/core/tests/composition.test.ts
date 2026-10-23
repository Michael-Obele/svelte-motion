/**
 * The composition registry.
 *
 * Registration is global module state, so every test starts from a clean slate
 * and re-registers what it needs.
 */

import { beforeEach, describe, expect, test } from "vite-plus/test";
import * as v from "valibot";
import type { Component } from "svelte";
import {
  clearCompositions,
  collectCompositions,
  defineComposition,
  getComposition,
  getCompositions,
  type CompositionConfig,
} from "../src/lib/motion/composition.js";

/** A stand-in component: the registry never renders it. */
const FakeComponent = (() => {}) as unknown as Component<Record<string, unknown>>;

const baseConfig = (overrides: Partial<CompositionConfig> = {}): CompositionConfig => ({
  id: "hello-world",
  component: FakeComponent,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 90,
  ...overrides,
});

beforeEach(() => {
  clearCompositions();
});

describe("defineComposition", () => {
  test("returns the config so a file can default-export it", () => {
    const config = baseConfig();
    expect(defineComposition(config)).toBe(config);
  });

  test("rejects a missing id", () => {
    expect(() => defineComposition(baseConfig({ id: "" }))).toThrow(/needs an id/);
  });

  test("accepts kebab-case ids", () => {
    for (const id of ["hello-world", "a", "a1-b2-c3", "30fps"]) {
      clearCompositions();
      expect(() => defineComposition(baseConfig({ id }))).not.toThrow();
    }
  });

  test("rejects non-kebab-case ids", () => {
    for (const id of [
      "HelloWorld",
      "hello_world",
      "hello world",
      "-hello",
      "hello-",
      "hello--world",
    ]) {
      expect(() => defineComposition(baseConfig({ id }))).toThrow(/must be kebab-case/);
    }
  });

  test("rejects non-positive or non-integer video config", () => {
    const keys = ["width", "height", "fps", "durationInFrames"] as const;
    const badValues = [0, -1, 1.5, NaN, Infinity];

    for (const key of keys) {
      for (const value of badValues) {
        expect(() => defineComposition(baseConfig({ [key]: value }))).toThrow(
          new RegExp(`needs a positive integer ${key}`),
        );
      }
    }
  });

  test("rejects a duplicate id", () => {
    defineComposition(baseConfig());

    expect(() => defineComposition(baseConfig())).toThrow(/already registered/);
  });

  test("a failed registration does not occupy the id", () => {
    expect(() => defineComposition(baseConfig({ fps: 0 }))).toThrow();
    expect(() => defineComposition(baseConfig())).not.toThrow();
  });
});

describe("getCompositions / getComposition", () => {
  test("returns registrations in registration order", () => {
    defineComposition(baseConfig({ id: "zulu" }));
    defineComposition(baseConfig({ id: "alpha" }));
    defineComposition(baseConfig({ id: "mike" }));

    expect(getCompositions().map((config) => config.id)).toEqual(["zulu", "alpha", "mike"]);
  });

  test("getCompositions returns a copy, not the live registry", () => {
    defineComposition(baseConfig());

    getCompositions().push(baseConfig({ id: "smuggled" }));

    expect(getCompositions()).toHaveLength(1);
  });

  test("getComposition finds one by id and returns undefined otherwise", () => {
    const config = defineComposition(baseConfig());

    expect(getComposition("hello-world")).toBe(config);
    expect(getComposition("nope")).toBeUndefined();
  });

  test("clearCompositions empties the registry", () => {
    defineComposition(baseConfig());
    clearCompositions();

    expect(getCompositions()).toEqual([]);
  });
});

describe("collectCompositions", () => {
  test("collects an app-owned glob in path order", () => {
    defineComposition(baseConfig({ id: "first" }));
    defineComposition(baseConfig({ id: "second" }));

    const collected = collectCompositions({
      "/src/compositions/first/index.ts": { default: getComposition("first") },
      "/src/compositions/second/index.ts": { default: getComposition("second") },
    });

    expect(collected.map((config) => config.id)).toEqual(["first", "second"]);
  });

  test("registers a default export the registry has not seen", () => {
    const config = baseConfig({ id: "from-glob" });

    const collected = collectCompositions({
      "/src/compositions/from-glob/index.ts": { default: config },
    });

    expect(collected).toHaveLength(1);
    expect(getComposition("from-glob")).toBe(config);
  });

  test("throws with the file path when a module has no default export", () => {
    expect(() => collectCompositions({ "/src/compositions/broken/index.ts": {} })).toThrow(
      /Composition file "\/src\/compositions\/broken\/index.ts" has no default export/,
    );
  });

  test("throws with the file path when the default export is not a composition", () => {
    expect(() =>
      collectCompositions({ "/src/compositions/broken/index.ts": { default: { id: 7 } } }),
    ).toThrow(/must default-export defineComposition/);
  });

  test("an empty glob is not an error", () => {
    expect(collectCompositions({})).toEqual([]);
  });
});

describe("valibot schema", () => {
  const GreetingSchema = v.object({
    name: v.string(),
    fontSize: v.number(),
  });
  type GreetingProps = v.InferOutput<typeof GreetingSchema> & Record<string, unknown>;

  test("accepts defaultProps that match the schema", () => {
    const config: CompositionConfig<GreetingProps> = {
      id: "greeting",
      component: FakeComponent as unknown as Component<GreetingProps>,
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 90,
      defaultProps: { name: "Ada", fontSize: 64 },
      schema: GreetingSchema,
    };

    expect(() => defineComposition(config)).not.toThrow();
    expect(getComposition("greeting")).toBe(config);
  });

  test("rejects defaultProps that do not match, naming the composition and the field", () => {
    const config = {
      id: "greeting",
      component: FakeComponent,
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 90,
      defaultProps: { name: 42, fontSize: "big" },
      schema: GreetingSchema,
    } as unknown as CompositionConfig;

    expect(() => defineComposition(config)).toThrow(
      /Composition "greeting" defaultProps do not match its schema/,
    );
    expect(() => defineComposition(config)).toThrow(/name:/);
    expect(getComposition("greeting")).toBeUndefined();
  });

  test("a schema without defaultProps is allowed", () => {
    const config = {
      id: "greeting",
      component: FakeComponent,
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 90,
      schema: GreetingSchema,
    } as unknown as CompositionConfig;

    expect(() => defineComposition(config)).not.toThrow();
  });
});
