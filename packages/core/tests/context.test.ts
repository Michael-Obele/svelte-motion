/**
 * The frame runtime's local-frame math, unit-tested without a DOM.
 *
 * `Sequence`, `Loop` and `Freeze` are thin wrappers: each one builds a
 * `DerivedMotionContext` with a different derive function. Those three functions
 * are the whole of "local frame", so they are what these tests pin down —
 * `tests/sequence.test.ts` then proves the mounted components use them.
 */

import { describe, expect, test } from "vite-plus/test";
import {
  DerivedMotionContext,
  MotionContext,
  type MotionState,
  type VideoConfig,
} from "../src/lib/motion/context.svelte.js";

/** A parent context with no Svelte runes involved, so this stays a pure unit test. */
const plainParent = (frame: number, config: Partial<VideoConfig> = {}): MotionState => ({
  frame,
  fps: config.fps ?? 30,
  width: config.width ?? 1920,
  height: config.height ?? 1080,
  durationInFrames: config.durationInFrames ?? 90,
});

/** `Sequence`'s derive function. */
const shift =
  (from: number) =>
  (parent: MotionState): number =>
    parent.frame - from;

/** `Loop`'s wrap-around derive function. */
const wrap =
  (durationInFrames: number, from = 0) =>
  (parent: MotionState): number =>
    (((parent.frame - from) % durationInFrames) + durationInFrames) % durationInFrames;

/** `Freeze`'s derive function. */
const pin = (frame: number) => (): number => frame;

describe("MotionContext", () => {
  test("defaults are 30fps 1920x1080 over 90 frames at frame 0", () => {
    const context = new MotionContext();

    expect(context.frame).toBe(0);
    expect(context.fps).toBe(30);
    expect(context.width).toBe(1920);
    expect(context.height).toBe(1080);
    expect(context.durationInFrames).toBe(90);
  });

  test("takes a partial config and leaves the rest at defaults", () => {
    const context = new MotionContext({ fps: 60, width: 1080 });

    expect(context.fps).toBe(60);
    expect(context.width).toBe(1080);
    expect(context.height).toBe(1080);
    expect(context.durationInFrames).toBe(90);
  });

  test("seek() and the frame setter are the same move", () => {
    const context = new MotionContext();

    context.frame = 12;
    expect(context.frame).toBe(12);

    context.seek(24);
    expect(context.frame).toBe(24);
  });
});

describe("DerivedMotionContext", () => {
  test("Sequence: parent frame 45 with from 30 gives local 15", () => {
    const derived = new DerivedMotionContext(plainParent(45), shift(30));

    expect(derived.frame).toBe(15);
  });

  test("nested Sequence: outer from 30, inner from 10 gives local 5", () => {
    const global = plainParent(45);
    const outer = new DerivedMotionContext(global, shift(30));
    const inner = new DerivedMotionContext(outer, shift(10));

    expect(outer.frame).toBe(15);
    expect(inner.frame).toBe(5);
  });

  test("Loop: duration 20, unlimited times, wraps at frame 45 to 5", () => {
    const derived = new DerivedMotionContext(plainParent(45), wrap(20));

    expect(derived.frame).toBe(5);
  });

  test("Loop: wraps repeatedly rather than running off the end", () => {
    const derive = wrap(20);

    expect(new DerivedMotionContext(plainParent(0), derive).frame).toBe(0);
    expect(new DerivedMotionContext(plainParent(19), derive).frame).toBe(19);
    expect(new DerivedMotionContext(plainParent(20), derive).frame).toBe(0);
    expect(new DerivedMotionContext(plainParent(41), derive).frame).toBe(1);
  });

  test("Loop: a negative offset still wraps into range", () => {
    // Loop's `from` shifts first; JS `%` keeps the sign, the double modulo fixes it.
    const derived = new DerivedMotionContext(plainParent(5), wrap(20, 10));

    expect(derived.frame).toBe(15);
  });

  test("Freeze: the frame never moves with the parent", () => {
    const derived = new DerivedMotionContext(plainParent(45), pin(7));

    expect(derived.frame).toBe(7);
    expect(new DerivedMotionContext(plainParent(0), pin(7)).frame).toBe(7);
    expect(new DerivedMotionContext(plainParent(1000), pin(7)).frame).toBe(7);
  });

  test("config fields pass straight through from the parent", () => {
    const parent = plainParent(45, { fps: 60, width: 800, height: 600, durationInFrames: 120 });
    const derived = new DerivedMotionContext(parent, shift(30));

    expect(derived.fps).toBe(60);
    expect(derived.width).toBe(800);
    expect(derived.height).toBe(600);
    expect(derived.durationInFrames).toBe(120);
  });

  test("reads are live: the parent's frame drives the derived frame", () => {
    const parent = new MotionContext({ fps: 30 });
    const derived = new DerivedMotionContext(parent, shift(30));

    parent.frame = 45;
    expect(derived.frame).toBe(15);

    parent.frame = 90;
    expect(derived.frame).toBe(60);
  });

  test("three levels of nesting compose additively", () => {
    const global = plainParent(100);
    const a = new DerivedMotionContext(global, shift(40)); // 60
    const b = new DerivedMotionContext(a, shift(15)); // 45
    const c = new DerivedMotionContext(b, pin(3)); // 3

    expect(a.frame).toBe(60);
    expect(b.frame).toBe(45);
    expect(c.frame).toBe(3);
  });
});
