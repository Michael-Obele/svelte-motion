/**
 * Timeline registry: register/unregister and nesting depth.
 *
 * Class behaviour is tested without a DOM; depth and mount lifetime are
 * tested through `Player#getSequences()`.
 */

import { render, cleanup } from "@testing-library/svelte";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { tick } from "svelte";
import Player from "../src/lib/player/Player.svelte";
import {
  DerivedMotionContext,
  MotionContext,
  type SequenceEntry,
} from "../src/lib/motion/context.svelte.js";
import RegistrySequences from "./fixtures/RegistrySequences.svelte";
import RegistryAutoIds from "./fixtures/RegistryAutoIds.svelte";

type SequenceApi = {
  getSequences: () => SequenceEntry[];
  seek: (n: number) => void;
};

const entry = (overrides: Partial<SequenceEntry> = {}): SequenceEntry => ({
  id: "a",
  from: 30,
  absoluteFrom: 30,
  durationInFrames: 60,
  depth: 0,
  ...overrides,
});

const playerProps = (component: unknown, startFrame: number) => ({
  component: component as never,
  fps: 30,
  width: 640,
  height: 360,
  durationInFrames: 90,
  startFrame,
  controls: false as const,
});

afterEach(() => {
  cleanup();
});

describe("MotionContext registry", () => {
  test("registers and unregisters by id", () => {
    const ctx = new MotionContext();

    expect(ctx.getSequences()).toEqual([]);

    ctx.registerSequence(entry());
    expect(ctx.getSequences()).toHaveLength(1);

    ctx.unregisterSequence("a");
    expect(ctx.getSequences()).toEqual([]);
  });

  test("re-registering an id updates instead of duplicating", () => {
    const ctx = new MotionContext();

    ctx.registerSequence(entry({ from: 30, absoluteFrom: 30 }));
    ctx.registerSequence(entry({ from: 40, absoluteFrom: 40 }));

    const seqs = ctx.getSequences();
    expect(seqs).toHaveLength(1);
    expect(seqs[0].from).toBe(40);
    expect(seqs[0].absoluteFrom).toBe(40);
  });

  test("unregistering an unknown id is a no-op", () => {
    const ctx = new MotionContext();
    ctx.registerSequence(entry());

    expect(() => ctx.unregisterSequence("missing")).not.toThrow();
    expect(ctx.getSequences()).toHaveLength(1);
  });

  test("getSequences returns a copy", () => {
    const ctx = new MotionContext();
    ctx.registerSequence(entry());

    const copy = ctx.getSequences();
    copy.push(entry({ id: "smuggled" }));

    expect(ctx.getSequences()).toHaveLength(1);
  });

  test("DerivedMotionContext forwards to the root", () => {
    const root = new MotionContext();
    const derived = new DerivedMotionContext(root, (p) => p.frame);

    derived.registerSequence(entry({ id: "x", depth: 1 }));
    expect(root.getSequences()).toHaveLength(1);
    expect(derived.getSequences()).toHaveLength(1);

    derived.unregisterSequence("x");
    expect(root.getSequences()).toEqual([]);
  });
});

describe("mounted Sequences", () => {
  test("nested Sequences report depth and absolute offsets", async () => {
    const result = render(Player, playerProps(RegistrySequences, 45));
    await tick();
    await tick();

    const api = result.component as unknown as SequenceApi;
    const seqs = api.getSequences();

    expect(seqs).toHaveLength(2);

    const outer = seqs.find((s) => s.id === "outer");
    const inner = seqs.find((s) => s.id === "inner");

    expect(outer).toMatchObject({ from: 30, absoluteFrom: 30, durationInFrames: 60, depth: 0 });
    expect(inner).toMatchObject({ from: 10, absoluteFrom: 40, durationInFrames: 20, depth: 1 });
  });

  test("inner unregisters while its parent is outside the visible range", async () => {
    const result = render(Player, playerProps(RegistrySequences, 45));
    await tick();
    await tick();

    const api = result.component as unknown as SequenceApi;
    expect(api.getSequences()).toHaveLength(2);

    api.seek(0);
    await tick();
    await tick();

    const seqs = api.getSequences();
    expect(seqs).toHaveLength(1);
    expect(seqs[0].id).toBe("outer");
  });

  test("Sequences without ids get unique auto ids", async () => {
    const result = render(Player, playerProps(RegistryAutoIds, 5));
    await tick();
    await tick();

    const api = result.component as unknown as SequenceApi;
    const seqs = api.getSequences();

    expect(seqs).toHaveLength(2);
    expect(seqs[0].id).not.toBe(seqs[1].id);
    for (const s of seqs) {
      expect(s.id).toMatch(/^sequence-\d+$/);
    }
    expect(seqs.find((s) => s.from === 0)?.depth).toBe(0);
    expect(seqs.find((s) => s.from === 10)?.depth).toBe(0);
  });
});
