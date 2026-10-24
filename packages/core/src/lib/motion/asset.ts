/**
 * Asset helpers.
 *
 * `staticFile` resolves a path inside `static/` (or `public/`) through the
 * app's base, so the same composition works at `/` and at `/my-app/`.
 * `prefetch` injects a preload link for the resolved URL.
 *
 * Both are SSR-safe: no `window`/`document` at module scope.
 */

/**
 * Resolves a file in `static/` through the app base.
 *
 * @param relativePath - Path inside `static/`, e.g. `"image.png"` or `"videos/intro.mp4"`
 * @returns Absolute URL path, e.g. `"/image.png"` or `"/my-app/image.png"`
 * @throws If given an absolute URL (`http://`, `https://`, `//host/...`) — those are not static files
 */
export const staticFile = (relativePath: string): string => {
  if (typeof relativePath !== "string") {
    throw new TypeError(`staticFile() expected a string, got ${typeof relativePath}`);
  }

  if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
    throw new Error(
      `staticFile() does not support absolute URLs - got "${relativePath}". Pass the URL directly without wrapping it in staticFile().`,
    );
  }

  if (/^\/\/[^/]+\//.test(relativePath)) {
    throw new Error(
      `staticFile() does not support absolute URLs - got "${relativePath}". Pass the URL directly without wrapping it in staticFile().`,
    );
  }

  let base = "/";

  try {
    const env = (import.meta as unknown as { env?: { BASE_URL?: string } })?.env;

    if (typeof env?.BASE_URL === "string" && env.BASE_URL.length > 0) {
      base = env.BASE_URL;
    }
  } catch {
    base = "/";
  }

  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const trimmedPath = relativePath.replace(/^\/+/, "");
  const joined = `${normalizedBase}${trimmedPath}`;

  return joined.replace(/\/{2,}/g, "/");
};

const getExtension = (href: string): string => {
  const withoutQuery = href.split("?")[0].split("#")[0];
  const parts = withoutQuery.split(".");

  if (parts.length < 2) {
    return "";
  }

  return parts.pop()!.toLowerCase();
};

/**
 * Injects a `<link rel="preload">` for `src` into `document.head`.
 *
 * Infers `as` from the extension:
 * - image: `as="image"` (png, jpg, jpeg, gif, webp, svg, avif, bmp, ico)
 * - video: `as="video"` (mp4, webm, mov)
 * - audio: `as="audio"` (mp3, wav, m4a, ogg)
 * - font: `as="font"` + `crossorigin="anonymous"` (woff, woff2, ttf, otf)
 * - else: `as="fetch"`
 *
 * @param src - Path inside `static/`, resolved through `staticFile`
 * @returns Cleanup function that removes the link. No-op when `document` is undefined.
 */
export const prefetch = (src: string): (() => void) => {
  if (typeof document === "undefined") {
    return () => {};
  }

  const href = staticFile(src);
  const ext = getExtension(href);

  let as: string;
  let crossOrigin: string | null = null;

  if (["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp", "ico"].includes(ext)) {
    as = "image";
  } else if (["mp4", "webm", "mov"].includes(ext)) {
    as = "video";
  } else if (["mp3", "wav", "m4a", "ogg"].includes(ext)) {
    as = "audio";
  } else if (["woff", "woff2", "ttf", "otf"].includes(ext)) {
    as = "font";
    crossOrigin = "anonymous";
  } else {
    as = "fetch";
  }

  const link = document.createElement("link");
  link.rel = "preload";
  link.href = href;
  (link as unknown as Record<string, string>).as = as;

  if (crossOrigin) {
    link.crossOrigin = crossOrigin;
  }

  if (document.head) {
    document.head.appendChild(link);
  } else {
    document.documentElement.appendChild(link);
  }

  return () => {
    link.remove();
  };
};
