/**
 * `frameTransition` — Svelte's transition factories, driven by the frame.
 *
 * The property that `transition:` cannot give a renderer is that the same frame
 * yields the same pixels whenever it is reached: seeking forward, past the end,
 * and back again must land on the identical value. That is what most of these
 * tests pin. The rest check the window maths (`from`, `durationInFrames`,
 * `delayInFrames`), the `out` direction, local frames inside a `Sequence`, and
 * that nothing touches the Web Animations API.
 */

import { render, cleanup } from "@testing-library/svelte";
import { afterEach, describe, expect, test } from "vite-plus/test";
import FrameTransitionHost from "./fixtures/FrameTransitionHost.svelte";

/** The bridge `MotionRoot` publishes; same guard style as `sequence.test.ts`. */
const seekTo = async (frame: number): Promise<void> => {
  const bridge = window as unknown as Record<string, unknown>;
  const setFrame = bridge.svelteMotion_setFrame;

  if (typeof setFrame !== "function") {
    throw new Error("MotionRoot did not publish window.svelteMotion_setFrame");
  }

  await (setFrame as (next: number) => Promise<void>)(frame);
};

/** The element carrying the transition labelled `name`, or a clear failure. */
const target = (container: HTMLElement, name: string): HTMLElement => {
  const element = container.querySelector(`[data-ft="${name}"]`);

  if (element === null) {
    throw new Error(`No element matching [data-ft="${name}"]`);
  }

  return element as HTMLElement;
};

/** `opacity` as the action applied it, or `null` when the node is in its natural state. */
const appliedOpacity = (container: HTMLElement, name: string): string | null =>
  target(container, name).style.getPropertyValue("opacity") || null;

afterEach(() => {
  cleanup();
});

describe("frameTransition", () => {
  test("holds the intro start value before its window opens", async () => {
    const { container } = render(FrameTransitionHost);
    await seekTo(5);

    expect(appliedOpacity(container, "root")).toBe("0");
  });

  test("reaches the eased midpoint of its window", async () => {
    const { container } = render(FrameTransitionHost);
    await seekTo(15);

    // from=10, durationInFrames=10, linear easing: frame 15 is half way.
    expect(appliedOpacity(container, "root")).toBe("0.5");
  });

  test("returns the node to its natural state once the transition is over", async () => {
    const { container } = render(FrameTransitionHost);
    await seekTo(15);
    expect(appliedOpacity(container, "root")).toBe("0.5");

    await seekTo(20);
    expect(appliedOpacity(container, "root")).toBeNull();
  });

  test("gives the same value for the same frame however it is reached", async () => {
    const { container } = render(FrameTransitionHost);

    await seekTo(12);
    const first = appliedOpacity(container, "root");

    await seekTo(60);
    await seekTo(40);
    await seekTo(12);

    expect(appliedOpacity(container, "root")).toBe(first);
    expect(first).toBe("0.2");
  });

  test("runs backwards with direction: out", async () => {
    const { container } = render(FrameTransitionHost);

    // Before an outro starts the element is natural; after it ends it is gone.
    await seekTo(0);
    expect(appliedOpacity(container, "out")).toBeNull();

    await seekTo(5);
    expect(appliedOpacity(container, "out")).toBe("0.5");

    await seekTo(10);
    expect(appliedOpacity(container, "out")).toBe("0");
  });

  test("reads the Sequence's local frame, not the global one", async () => {
    const { container } = render(FrameTransitionHost);

    // The Sequence starts at global 30; its fade starts at local 5 for 10 frames,
    // so global 40 is local 10 — half way.
    await seekTo(40);
    expect(appliedOpacity(container, "sequence")).toBe("0.5");

    // Outside the window the child is not mounted at all.
    await seekTo(20);
    expect(container.querySelector('[data-ft="sequence"]')).toBeNull();
  });

  test("drives a real Svelte factory and clears it after", async () => {
    const { container } = render(FrameTransitionHost);
    const flown = target(container, "fly");

    await seekTo(5);
    expect(flown.style.getPropertyValue("transform")).toContain("translate");

    await seekTo(10);
    expect(flown.getAttribute("style") ?? "").toBe("");
  });

  test("never creates a Web Animation", async () => {
    // A seek that produced a WAAPI animation would be captured at whatever point
    // the clock had reached, which is the whole failure this action exists to avoid.
    const original = (Element.prototype as unknown as { animate?: unknown }).animate;

    Object.defineProperty(Element.prototype, "animate", {
      configurable: true,
      writable: true,
      value: () => {
        throw new Error("frameTransition must not call animate()");
      },
    });

    try {
      const { container } = render(FrameTransitionHost);
      await seekTo(15);
      expect(appliedOpacity(container, "root")).toBe("0.5");
    } finally {
      if (original === undefined) {
        delete (Element.prototype as unknown as { animate?: unknown }).animate;
      } else {
        Object.defineProperty(Element.prototype, "animate", {
          configurable: true,
          writable: true,
          value: original,
        });
      }
    }
  });
});
