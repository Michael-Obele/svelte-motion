/**
 * The M1 gate, mounted: nested `Sequence`s must report the right local frames.
 *
 * `tests/context.test.ts` proves the arithmetic; this proves the components use
 * it. Both channels are checked at every level, because they can drift
 * independently — the snippet argument is computed in the component body, the
 * context value is what `useCurrentFrame()` sees.
 */

import { render } from "@testing-library/svelte";
import { describe, expect, test } from "vite-plus/test";
import NestedSequences from "./fixtures/NestedSequences.svelte";

/** One attribute off the first element matching `selector`, or a clear error. */
const attributeOf = (
  container: HTMLElement,
  selector: string,
  attribute: string,
): string | null => {
  const element = container.querySelector(selector);

  if (element === null) {
    throw new Error(`No element matching ${selector}`);
  }

  return element.getAttribute(attribute);
};

/** `data-frame` off the element matching `[data-probe=label]` or `[data-snippet=label]`. */
const frameOf = (container: HTMLElement, channel: "probe" | "snippet", label: string): number =>
  Number(attributeOf(container, `[data-${channel}="${label}"]`, "data-frame"));

/**
 * The two globals `MotionRoot` publishes on mount, read through a guard so a
 * regression throws with a name instead of "undefined is not a function".
 */
const frameBridge = (): {
  setFrame: (next: number) => Promise<void>;
  getFrame: () => number;
} => {
  const raw = window as unknown as Record<string, unknown>;
  const { svelteMotion_setFrame: setFrame, svelteMotion_getFrame: getFrame } = raw;

  if (typeof setFrame !== "function") {
    throw new Error("MotionRoot did not publish window.svelteMotion_setFrame");
  }

  if (typeof getFrame !== "function") {
    throw new Error("MotionRoot did not publish window.svelteMotion_getFrame");
  }

  return {
    setFrame: setFrame as (next: number) => Promise<void>,
    getFrame: getFrame as () => number,
  };
};

describe("nested Sequence", () => {
  test("at global frame 45 the outer Sequence sees 15 and the inner 5", () => {
    const { container } = render(NestedSequences, { props: { initialFrame: 45 } });

    // Snippet channel.
    expect(frameOf(container, "snippet", "outer")).toBe(15);
    expect(frameOf(container, "snippet", "inner")).toBe(5);

    // Context channel.
    expect(frameOf(container, "probe", "root")).toBe(45);
    expect(frameOf(container, "probe", "outer")).toBe(15);
    expect(frameOf(container, "probe", "inner")).toBe(5);
  });

  test("every level agrees between the snippet argument and the context", () => {
    for (const initialFrame of [40, 45, 60, 90]) {
      const { container } = render(NestedSequences, { props: { initialFrame } });

      expect(frameOf(container, "probe", "outer")).toBe(frameOf(container, "snippet", "outer"));
      expect(frameOf(container, "probe", "inner")).toBe(frameOf(container, "snippet", "inner"));
    }
  });

  test("driving the frame the way the renderer does moves every derived local frame", async () => {
    const { container } = render(NestedSequences, { props: { initialFrame: 45 } });

    expect(frameOf(container, "probe", "inner")).toBe(5);

    // `MotionRoot` publishes this on mount; it is the renderer's only handle on
    // the timeline. It resolves after Svelte flushed *and* after a paint, which
    // is why a screenshot taken straight after it cannot catch the last frame.
    const { setFrame } = frameBridge();

    expect(typeof setFrame).toBe("function");
    await setFrame(90);

    expect(frameOf(container, "probe", "root")).toBe(90);
    expect(frameOf(container, "probe", "outer")).toBe(60);
    expect(frameOf(container, "probe", "inner")).toBe(50);

    // The snippet channel follows the same move.
    expect(frameOf(container, "snippet", "outer")).toBe(60);
    expect(frameOf(container, "snippet", "inner")).toBe(50);
  });

  test("MotionRoot publishes the getter the studio uses to read back the frame", async () => {
    const { container } = render(NestedSequences, { props: { initialFrame: 12 } });
    const { getFrame, setFrame } = frameBridge();

    expect(typeof getFrame).toBe("function");
    expect(getFrame()).toBe(12);
    expect(frameOf(container, "probe", "root")).toBe(12);

    await setFrame(33);
    expect(getFrame()).toBe(33);
  });

  test("the video config passes through the context to every level", () => {
    const { container } = render(NestedSequences, { props: { initialFrame: 45 } });

    for (const label of ["root", "outer", "inner"]) {
      const selector = `[data-probe="${label}"]`;

      expect(attributeOf(container, selector, "data-fps")).toBe("30");
      expect(attributeOf(container, selector, "data-width")).toBe("1920");
      expect(attributeOf(container, selector, "data-height")).toBe("1080");
      expect(attributeOf(container, selector, "data-duration")).toBe("90");
    }
  });

  test("a Sequence that has not started renders nothing", () => {
    const { container } = render(NestedSequences, { props: { initialFrame: 10 } });

    // `from={30}` means local frame -20: outside the sequence, so it is hidden.
    expect(container.querySelector('[data-probe="outer"]')).toBeNull();
    expect(container.querySelector('[data-probe="inner"]')).toBeNull();
    expect(container.querySelector('[data-snippet="outer"]')).toBeNull();

    // The root still renders.
    expect(frameOf(container, "probe", "root")).toBe(10);
  });

  test("the root frame is the frame it was asked for at mount", () => {
    const { container } = render(NestedSequences, { props: { initialFrame: 0 } });
    const root = '[data-probe="root"]';

    expect(attributeOf(container, root, "data-frame")).toBe("0");
    // `useCurrentFrame()` reads the context once, so it matches at mount too.
    expect(attributeOf(container, root, "data-initial-frame")).toBe("0");
  });
});
