/**
 * Media components — readiness handshake.
 *
 * Each component opens a `delayRender` handle on mount and releases it exactly
 * once on success or error (idempotent per `ready.ts`). Tests mount the real
 * Svelte components in jsdom and dispatch DOM events.
 */

import { render, cleanup } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, test, vi } from "vite-plus/test";
import { getPendingLabels, isReady, resetReadiness } from "../src/lib/motion/ready.js";
import Img from "../src/lib/timeline/Img.svelte";
import IFrame from "../src/lib/timeline/IFrame.svelte";
import MediaHost from "./fixtures/MediaHost.svelte";

beforeEach(() => {
  resetReadiness();
});

afterEach(() => {
  cleanup();
  resetReadiness();
  vi.restoreAllMocks();
});

describe("Img", () => {
  test("src is resolved through staticFile and one handle is pending", () => {
    const { container } = render(Img, { props: { src: "photo.png", alt: "x" } });
    const img = container.querySelector("img") as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe("/photo.png");
    expect(isReady()).toBe(false);
    expect(getPendingLabels().length).toBe(1);
  });

  test("load releases the handle", async () => {
    const { container } = render(Img, { props: { src: "photo.png" } });
    const img = container.querySelector("img") as HTMLImageElement;
    img.dispatchEvent(new Event("load"));
    expect(isReady()).toBe(true);
  });

  test("error warns and releases", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(Img, { props: { src: "missing.png" } });
    const img = container.querySelector("img") as HTMLImageElement;
    img.dispatchEvent(new Event("error"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("missing.png"));
    expect(isReady()).toBe(true);
  });

  test("unmount without load/error still releases", () => {
    const { unmount } = render(Img, { props: { src: "photo.png" } });
    expect(isReady()).toBe(false);
    unmount();
    expect(isReady()).toBe(true);
  });
});

describe("Video", () => {
  test("src resolved and handle pending until loadeddata", () => {
    const { container } = render(MediaHost, { props: { kind: "video", src: "clip.mp4" } });
    const video = container.querySelector("video") as HTMLVideoElement | null;
    expect(video).not.toBeNull();
    expect(video!.getAttribute("src")).toBe("/clip.mp4");
    expect(isReady()).toBe(false);
    video!.dispatchEvent(new Event("loadeddata"));
    expect(isReady()).toBe(true);
  });

  test("error warns and releases", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(MediaHost, { props: { kind: "video", src: "missing.mp4" } });
    const video = container.querySelector("video") as HTMLVideoElement;
    video.dispatchEvent(new Event("error"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("missing.mp4"));
    expect(isReady()).toBe(true);
  });

  test("seeked releases a seek handle (loadeddata then seeked)", () => {
    const { container } = render(MediaHost, { props: { kind: "video", src: "clip.mp4" } });
    const video = container.querySelector("video") as HTMLVideoElement;
    video.dispatchEvent(new Event("loadeddata"));
    expect(isReady()).toBe(true);
    // After loadeddata, a seek handle would be opened on frame change; we can at least
    // verify that dispatching seeked does not throw and leaves ready true when no seek handle is open.
    video.dispatchEvent(new Event("seeked"));
    expect(isReady()).toBe(true);
  });
});

describe("Audio", () => {
  test("src resolved and handle pending until loadeddata", () => {
    const { container } = render(MediaHost, { props: { kind: "audio", src: "sound.mp3" } });
    const audio = container.querySelector("audio") as HTMLAudioElement | null;
    expect(audio).not.toBeNull();
    expect(audio!.getAttribute("src")).toBe("/sound.mp3");
    expect(isReady()).toBe(false);
    audio!.dispatchEvent(new Event("loadeddata"));
    expect(isReady()).toBe(true);
  });

  test("error warns and releases", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(MediaHost, { props: { kind: "audio", src: "missing.mp3" } });
    const audio = container.querySelector("audio") as HTMLAudioElement;
    audio.dispatchEvent(new Event("error"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("missing.mp3"));
    expect(isReady()).toBe(true);
  });
});

describe("IFrame", () => {
  test("src resolved and handle pending until load", () => {
    const { container } = render(IFrame, { props: { src: "page.html" } });
    const iframe = container.querySelector("iframe") as HTMLIFrameElement | null;
    expect(iframe).not.toBeNull();
    expect(iframe!.getAttribute("src")).toBe("/page.html");
    expect(isReady()).toBe(false);
    iframe!.dispatchEvent(new Event("load"));
    expect(isReady()).toBe(true);
  });

  test("error warns and releases", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(IFrame, { props: { src: "missing.html" } });
    const iframe = container.querySelector("iframe") as HTMLIFrameElement;
    iframe.dispatchEvent(new Event("error"));
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("missing.html"));
    expect(isReady()).toBe(true);
  });
});
