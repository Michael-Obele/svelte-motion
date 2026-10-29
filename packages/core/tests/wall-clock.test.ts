/**
 * The wall-clock animation guard.
 *
 * jsdom has no `document.getAnimations`, so each test installs a stub and the
 * suite checks both halves: that a running animation is reported exactly once
 * per identity, and that a finished one is not reported at all — a CSS animation
 * with `animation-fill-mode: forwards` stays in `getAnimations()` and is a static
 * style by the time the renderer screenshots it.
 */

import { render, cleanup } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { resetWallClockWarnings, warnOnWallClockAnimations } from "../src/lib/motion/wall-clock.js";
import FrameTransitionHost from "./fixtures/FrameTransitionHost.svelte";

/** A stand-in for `Animation`, narrowed to the fields the guard reads. */
type FakeAnimation = {
  playState: string;
  animationName?: string;
  transitionProperty?: string;
  effect?: { target?: Element | null };
};

/** Installs `animations` as the page's live animation set for one test. */
const stubAnimations = (animations: FakeAnimation[]): (() => void) => {
  Object.defineProperty(document, "getAnimations", {
    configurable: true,
    writable: true,
    value: () => animations as unknown as Animation[],
  });

  return () => {
    delete (document as unknown as { getAnimations?: unknown }).getAnimations;
  };
};

let uninstall: (() => void) | null = null;

beforeEach(() => {
  resetWallClockWarnings();
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  uninstall?.();
  uninstall = null;
  cleanup();
  vi.restoreAllMocks();
});

/** Every line the guard wrote to `console.warn` so far. */
const warningText = (): string[] =>
  vi.mocked(console.warn).mock.calls.map(([line]) => String(line));

describe("warnOnWallClockAnimations", () => {
  test("reports a running CSS animation by name", () => {
    uninstall = stubAnimations([{ playState: "running", animationName: "spin" }]);

    warnOnWallClockAnimations(12);

    const lines = warningText();
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("[svelte-motion]");
    expect(lines[0]).toContain('animation "spin"');
    expect(lines[0]).toContain("frame 12");
  });

  test("reports each identity once across a whole render", () => {
    uninstall = stubAnimations([{ playState: "running", animationName: "spin" }]);

    for (let frame = 0; frame < 90; frame += 1) {
      warnOnWallClockAnimations(frame);
    }

    expect(warningText()).toHaveLength(1);
  });

  test("names a CSS transition by the property it animates", () => {
    uninstall = stubAnimations([{ playState: "running", transitionProperty: "opacity" }]);

    warnOnWallClockAnimations(3);

    expect(warningText()[0]).toContain("transition on opacity");
  });

  test("names a Web animation by its host element", () => {
    const div = document.createElement("div");
    uninstall = stubAnimations([{ playState: "pending", effect: { target: div } }]);

    warnOnWallClockAnimations(3);

    expect(warningText()[0]).toContain("Web animation on <div>");
  });

  test("leaves a finished animation alone", () => {
    uninstall = stubAnimations([
      { playState: "finished", animationName: "fade-in" },
      { playState: "idle", animationName: "later" },
    ]);

    warnOnWallClockAnimations(80);

    expect(warningText()).toHaveLength(0);
  });

  test("is a no-op where getAnimations does not exist", () => {
    // jsdom itself: no getAnimations at all, and the guard must not throw.
    expect(() => warnOnWallClockAnimations(1)).not.toThrow();
    expect(warningText()).toHaveLength(0);
  });

  test("MotionRoot runs the guard on every seek", async () => {
    uninstall = stubAnimations([{ playState: "running", animationName: "spin" }]);
    render(FrameTransitionHost);

    const bridge = window as unknown as Record<string, unknown>;
    await (bridge.svelteMotion_setFrame as (next: number) => Promise<void>)(6);

    expect(warningText().some((line) => line.includes('animation "spin"'))).toBe(true);
  });
});
