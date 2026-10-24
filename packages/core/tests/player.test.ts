/**
 * Player: frame-accurate rAF playback, seek, loop, controls.
 *
 * Deterministic clock: `now` is a mutable variable, `schedule` captures the
 * callback instead of using rAF. No fake timers.
 */

import { render, cleanup } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import Player from "../src/lib/player/Player.svelte";
import PlayerProbe from "./fixtures/PlayerProbe.svelte";

type Captured = FrameRequestCallback | null;

const makeClock = (initial = 0) => {
  let nowValue = initial;
  let captured: Captured = null;
  let handles = 0;
  const scheduled: number[] = [];

  const now = () => nowValue;
  const advance = (ms: number) => {
    nowValue += ms;
  };
  const set = (ms: number) => {
    nowValue = ms;
  };
  const schedule = (cb: FrameRequestCallback): number => {
    captured = cb;
    const id = ++handles;
    scheduled.push(id);
    return id;
  };
  const cancel = vi.fn((_id: number) => {
    captured = null;
  });
  const flush = () => {
    const cb = captured;
    captured = null;
    if (cb) cb(nowValue);
  };
  const hasPending = () => captured !== null;

  return {
    now,
    advance,
    set,
    schedule,
    cancel,
    flush,
    hasPending,
    get captured() {
      return captured;
    },
  };
};

const frameOf = (container: HTMLElement): number => {
  const el = container.querySelector('[data-probe="player"]');
  if (!el) throw new Error("No [data-probe=player]");
  return Number(el.getAttribute("data-frame"));
};

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("Player", () => {
  test("play() then advance 1000ms and flush → frame 30", async () => {
    const clock = makeClock(0);
    const result = render(Player, {
      props: {
        component: PlayerProbe,
        fps: 30,
        width: 1920,
        height: 1080,
        durationInFrames: 90,
        startFrame: 0,
        now: clock.now,
        schedule: clock.schedule,
        cancel: clock.cancel,
      },
    });
    const api = result.component as unknown as {
      play: () => void;
      pause: () => void;
      seek: (n: number) => void;
    };
    expect(frameOf(result.container)).toBe(0);
    api.play();
    clock.advance(1000);
    clock.flush();
    await Promise.resolve();
    expect(frameOf(result.container)).toBe(30);
  });

  test("two ticks of 500ms total → still 30 (no drift from tick count)", async () => {
    const clock = makeClock(0);
    const result = render(Player, {
      props: {
        component: PlayerProbe,
        fps: 30,
        width: 1920,
        height: 1080,
        durationInFrames: 90,
        startFrame: 0,
        now: clock.now,
        schedule: clock.schedule,
        cancel: clock.cancel,
      },
    });
    const api = result.component as unknown as { play: () => void; seek: (n: number) => void };
    api.play();
    clock.advance(500);
    clock.flush();
    await Promise.resolve();
    expect(frameOf(result.container)).toBe(15);
    clock.advance(500);
    clock.flush();
    await Promise.resolve();
    expect(frameOf(result.container)).toBe(30);
  });

  test("pause() stops further ticks", async () => {
    const clock = makeClock(0);
    const result = render(Player, {
      props: {
        component: PlayerProbe,
        fps: 30,
        width: 1920,
        height: 1080,
        durationInFrames: 90,
        startFrame: 0,
        now: clock.now,
        schedule: clock.schedule,
        cancel: clock.cancel,
      },
    });
    const api = result.component as unknown as { play: () => void; pause: () => void };
    api.play();
    clock.advance(500);
    clock.flush();
    await Promise.resolve();
    expect(frameOf(result.container)).toBe(15);
    api.pause();
    expect(clock.cancel).toHaveBeenCalled();
    clock.advance(1000);
    clock.flush();
    await Promise.resolve();
    expect(frameOf(result.container)).toBe(15);
  });

  test("seek(45) → frame 45 immediately and following 250ms tick gives 52 (rebase)", async () => {
    const clock = makeClock(0);
    const result = render(Player, {
      props: {
        component: PlayerProbe,
        fps: 30,
        width: 1920,
        height: 1080,
        durationInFrames: 90,
        startFrame: 0,
        now: clock.now,
        schedule: clock.schedule,
        cancel: clock.cancel,
      },
    });
    const api = result.component as unknown as { play: () => void; seek: (n: number) => void };
    api.play();
    api.seek(45);
    await Promise.resolve();
    expect(frameOf(result.container)).toBe(45);
    clock.advance(250);
    clock.flush();
    await Promise.resolve();
    // 45 + 7.5 floored = 52
    expect(frameOf(result.container)).toBe(52);
  });

  test("loop at the end wraps to a low frame", async () => {
    const clock = makeClock(0);
    const result = render(Player, {
      props: {
        component: PlayerProbe,
        fps: 30,
        width: 1920,
        height: 1080,
        durationInFrames: 90,
        startFrame: 85,
        loop: true,
        now: clock.now,
        schedule: clock.schedule,
        cancel: clock.cancel,
      },
    });
    const api = result.component as unknown as { play: () => void };
    api.play();
    clock.advance(1000);
    clock.flush();
    await Promise.resolve();
    // elapsed 1000ms → raw 30, 85 + 30 = 115 % 90 = 25? No: frameAt uses elapsed, not startFrame+raw.
    // With loop, frameAt(1000,30,90,true)=30. But origin rebased to startFrame 85: origin = 0 - 85/30*1000 = -2833.33
    // elapsed = now - origin = 1000 - (-2833.33) = 3833.33, raw 115, 115%90=25
    expect(frameOf(result.container)).toBe(25);
  });

  test("non-loop at the end stops playing and pins to duration-1", async () => {
    const clock = makeClock(0);
    const result = render(Player, {
      props: {
        component: PlayerProbe,
        fps: 30,
        width: 1920,
        height: 1080,
        durationInFrames: 90,
        startFrame: 85,
        loop: false,
        now: clock.now,
        schedule: clock.schedule,
        cancel: clock.cancel,
      },
    });
    const api = result.component as unknown as { play: () => void };
    api.play();
    clock.advance(5000);
    clock.flush();
    await Promise.resolve();
    expect(frameOf(result.container)).toBe(89);
    // Further ticks should not advance
    clock.advance(1000);
    clock.flush();
    await Promise.resolve();
    expect(frameOf(result.container)).toBe(89);
  });

  test("range input reflects frame and fires onseek", async () => {
    const clock = makeClock(0);
    const result = render(Player, {
      props: {
        component: PlayerProbe,
        fps: 30,
        width: 1920,
        height: 1080,
        durationInFrames: 90,
        startFrame: 10,
        now: clock.now,
        schedule: clock.schedule,
        cancel: clock.cancel,
      },
    });
    const api = result.component as unknown as { seek: (n: number) => void };
    // Range should reflect initial frame
    const range = result.container.querySelector('input[type="range"]') as HTMLInputElement | null;
    expect(range).not.toBeNull();
    expect(range!.value).toBe("10");
    expect(range!.getAttribute("aria-label")).toBe("Frame");
    // Seek via API updates range
    api.seek(45);
    await Promise.resolve();
    expect((result.container.querySelector('input[type="range"]') as HTMLInputElement).value).toBe(
      "45",
    );
    expect(result.container.textContent).toContain("frame 45 / 90");
    expect(result.container.textContent).toContain("30 fps");
    // Play/pause button exists
    const button = result.container.querySelector("button") as HTMLButtonElement | null;
    expect(button).not.toBeNull();
    expect(button!.getAttribute("aria-label")).toBe("Play");
  });

  test("autoPlay starts playback on mount", async () => {
    const clock = makeClock(0);
    const result = render(Player, {
      props: {
        component: PlayerProbe,
        fps: 30,
        width: 1920,
        height: 1080,
        durationInFrames: 90,
        startFrame: 0,
        autoPlay: true,
        now: clock.now,
        schedule: clock.schedule,
        cancel: clock.cancel,
      },
    });
    // autoPlay schedules a tick
    expect(clock.hasPending()).toBe(true);
    clock.advance(1000);
    clock.flush();
    await Promise.resolve();
    expect(frameOf(result.container)).toBe(30);
  });

  test("controls=false hides the controls", async () => {
    const clock = makeClock(0);
    const result = render(Player, {
      props: {
        component: PlayerProbe,
        fps: 30,
        width: 1920,
        height: 1080,
        durationInFrames: 90,
        startFrame: 0,
        controls: false,
        now: clock.now,
        schedule: clock.schedule,
        cancel: clock.cancel,
      },
    });
    expect(result.container.querySelector('input[type="range"]')).toBeNull();
    expect(result.container.querySelector("button")).toBeNull();
  });
});
