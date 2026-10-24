import { afterEach, beforeEach, describe, expect, test } from "vite-plus/test";
import { prefetch, staticFile } from "../src/lib/motion/asset.js";

describe("staticFile", () => {
  test("joins base / with a simple path", () => {
    expect(staticFile("image.png")).toBe("/image.png");
    expect(staticFile("videos/intro.mp4")).toBe("/videos/intro.mp4");
  });

  test("strips leading slashes from the path", () => {
    expect(staticFile("/image.png")).toBe("/image.png");
    expect(staticFile("///a/b/c.png")).toBe("/a/b/c.png");
  });

  test("normalizes duplicate slashes in the joined result", () => {
    expect(staticFile("a//b///c.png")).toBe("/a/b/c.png");
  });

  test("handles nested paths", () => {
    expect(staticFile("a/b/c/d.png")).toBe("/a/b/c/d.png");
  });

  test("rejects http:// URLs", () => {
    expect(() => staticFile("http://example.com/image.png")).toThrow(
      /does not support absolute URLs/,
    );
  });

  test("rejects https:// URLs", () => {
    expect(() => staticFile("https://example.com/image.png")).toThrow(
      /does not support absolute URLs/,
    );
  });

  test("rejects protocol-relative //host/ URLs", () => {
    expect(() => staticFile("//example.com/image.png")).toThrow(/does not support absolute URLs/);
  });

  test("does not reject a path that happens to start with // but is not a host URL", () => {
    // "//image.png" is just a path with extra slashes, not a host URL — it normalizes to "/image.png".
    expect(staticFile("//image.png")).toBe("/image.png");
  });

  test("is SSR-safe: no window/document at module scope", () => {
    // Just calling it should not throw due to missing window.
    expect(() => staticFile("x.png")).not.toThrow();
  });
});

describe("prefetch", () => {
  beforeEach(() => {
    // Ensure head exists in jsdom.
    if (!document.head) {
      const head = document.createElement("head");
      document.documentElement.prepend(head);
    }
  });

  afterEach(() => {
    // Clean up any preload links we injected.
    for (const link of document.querySelectorAll('link[rel="preload"]')) {
      link.remove();
    }
  });

  test("injects a link with as=image for png", () => {
    const cleanup = prefetch("photo.png");
    const link = document.querySelector('link[rel="preload"]') as HTMLLinkElement | null;
    expect(link).not.toBeNull();
    expect(link!.getAttribute("href")).toBe("/photo.png");
    expect((link as unknown as Record<string, string>).as).toBe("image");
    cleanup();
    expect(document.querySelector('link[rel="preload"]')).toBeNull();
  });

  test("as=video for mp4/webm/mov", () => {
    for (const ext of ["mp4", "webm", "mov"]) {
      const cleanup = prefetch(`clip.${ext}`);
      const link = document.querySelector('link[rel="preload"]') as HTMLLinkElement | null;
      expect((link as unknown as Record<string, string>).as).toBe("video");
      cleanup();
    }
  });

  test("as=audio for mp3/wav/m4a/ogg", () => {
    for (const ext of ["mp3", "wav", "m4a", "ogg"]) {
      const cleanup = prefetch(`sound.${ext}`);
      const link = document.querySelector('link[rel="preload"]') as HTMLLinkElement | null;
      expect((link as unknown as Record<string, string>).as).toBe("audio");
      cleanup();
    }
  });

  test("as=font + crossorigin for woff/woff2/ttf/otf", () => {
    for (const ext of ["woff", "woff2", "ttf", "otf"]) {
      const cleanup = prefetch(`font.${ext}`);
      const link = document.querySelector('link[rel="preload"]') as HTMLLinkElement | null;
      expect((link as unknown as Record<string, string>).as).toBe("font");
      expect(link!.crossOrigin).toBe("anonymous");
      cleanup();
    }
  });

  test("as=fetch for unknown extensions", () => {
    const cleanup = prefetch("data.json");
    const link = document.querySelector('link[rel="preload"]') as HTMLLinkElement | null;
    expect((link as unknown as Record<string, string>).as).toBe("fetch");
    cleanup();
  });

  test("cleanup removes the link", () => {
    const cleanup = prefetch("image.png");
    expect(document.querySelectorAll('link[rel="preload"]').length).toBe(1);
    cleanup();
    expect(document.querySelectorAll('link[rel="preload"]').length).toBe(0);
  });

  test("resolves src through staticFile", () => {
    const cleanup = prefetch("/image.png");
    const link = document.querySelector('link[rel="preload"]') as HTMLLinkElement | null;
    expect(link!.getAttribute("href")).toBe("/image.png");
    cleanup();
  });
});
