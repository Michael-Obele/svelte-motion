/**
 * The readiness handshake.
 *
 * The bug this guards against is real and silent: if handles are a counter
 * instead of a Set, a double `continueRender` drives it negative, the renderer
 * thinks the frame is ready, and you ship a blank frame. Handles are a Set
 * precisely so that cannot happen.
 */

import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import {
  continueRender,
  delayRender,
  getPendingLabels,
  isReady,
  resetReadiness,
  waitForReady,
} from "../src/lib/motion/ready.js";

beforeEach(() => {
  resetReadiness();
});

afterEach(() => {
  resetReadiness();
});

describe("delayRender / continueRender", () => {
  test("a fresh module is ready", () => {
    expect(isReady()).toBe(true);
    expect(getPendingLabels()).toEqual([]);
  });

  test("a handle blocks readiness until it is continued", () => {
    const handle = delayRender("font: Inter");

    expect(isReady()).toBe(false);
    expect(getPendingLabels()).toEqual(["font: Inter"]);

    continueRender(handle);

    expect(isReady()).toBe(true);
    expect(getPendingLabels()).toEqual([]);
  });

  test("every open handle has to clear", () => {
    const first = delayRender("image");
    const second = delayRender("video");

    continueRender(first);
    expect(isReady()).toBe(false);
    expect(getPendingLabels()).toEqual(["video"]);

    continueRender(second);
    expect(isReady()).toBe(true);
  });

  test("continueRender is idempotent and cannot go negative", () => {
    const handle = delayRender();
    const second = delayRender();

    continueRender(handle);
    continueRender(handle);
    continueRender(handle);

    // Two handles were opened; only one closed. Still blocked — a counter would
    // already have reported ready here.
    expect(isReady()).toBe(false);

    continueRender(second);
    expect(isReady()).toBe(true);
  });

  test("continuing an unknown handle is a no-op", () => {
    const handle = delayRender();

    continueRender(999_999);
    expect(isReady()).toBe(false);

    continueRender(handle);
    expect(isReady()).toBe(true);
  });

  test("handles are unique", () => {
    const handles = new Set([delayRender(), delayRender(), delayRender()]);
    expect(handles.size).toBe(3);
  });

  test("the default label names the API that opened the handle", () => {
    delayRender();
    expect(getPendingLabels()).toEqual(["delayRender()"]);
  });

  test("getPendingLabels lists one label per open handle, in open order", () => {
    delayRender("a");
    delayRender("b");
    delayRender("c");

    expect(getPendingLabels()).toEqual(["a", "b", "c"]);
  });
});

describe("waitForReady", () => {
  test("resolves immediately when nothing is pending", async () => {
    await expect(waitForReady()).resolves.toBeUndefined();
  });

  test("resolves only once the last handle clears", async () => {
    const first = delayRender("a");
    const second = delayRender("b");

    let resolved = false;
    const waiting = waitForReady().then(() => {
      resolved = true;
    });

    continueRender(first);
    await Promise.resolve();
    await Promise.resolve();
    expect(resolved).toBe(false);

    continueRender(second);
    await waiting;
    expect(resolved).toBe(true);
  });

  test("resolves every waiter waiting on the same handles", async () => {
    const handle = delayRender();

    const all = Promise.all([waitForReady(), waitForReady(), waitForReady()]);
    continueRender(handle);

    await expect(all).resolves.toEqual([undefined, undefined, undefined]);
  });
});

describe("resetReadiness", () => {
  test("clears handles and labels", () => {
    delayRender("stuck");

    resetReadiness();

    expect(isReady()).toBe(true);
    expect(getPendingLabels()).toEqual([]);
  });

  test("resolves pending waiters instead of dropping them", async () => {
    delayRender("stuck");

    let resolved = false;
    const waiting = waitForReady().then(() => {
      resolved = true;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    resetReadiness();
    await waiting;

    expect(resolved).toBe(true);
  });
});

describe("installReadinessGlobal", () => {
  test("installs both globals and cleanup removes them", async () => {
    const bridge = window as unknown as Record<string, unknown>;
    delete bridge.svelteMotion_ready;
    delete bridge.svelteMotion_pendingHandles;

    const mod = await import("../src/lib/motion/ready.js");
    mod.installReadinessGlobal();

    expect(typeof bridge.svelteMotion_ready).toBe("function");
    expect(typeof bridge.svelteMotion_pendingHandles).toBe("function");
    expect((bridge.svelteMotion_pendingHandles as () => string[])()).toEqual([]);

    // Verify pending labels flow through the global.
    const handle = mod.delayRender("test-label");
    expect((bridge.svelteMotion_pendingHandles as () => string[])()).toEqual(["test-label"]);
    mod.continueRender(handle);
    expect((bridge.svelteMotion_pendingHandles as () => string[])()).toEqual([]);

    // Cleanup: remove globals (MotionRoot does this on unmount; we simulate).
    delete bridge.svelteMotion_ready;
    delete bridge.svelteMotion_pendingHandles;
    expect(bridge.svelteMotion_ready).toBeUndefined();
    expect(bridge.svelteMotion_pendingHandles).toBeUndefined();
  });
});
