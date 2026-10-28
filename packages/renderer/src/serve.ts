/**
 * Static server for a built studio.
 *
 * The renderer needs the studio bundle over HTTP — a `file://` page has no
 * origin, so `fetch`, module workers and font loading all behave differently
 * from production. `Bun.serve` is used instead of spawning `vite preview`
 * because the renderer must be able to stop the server from a `finally` block:
 * killing a `vite preview` process tree reliably was a real problem in the M0
 * spike, and `server.stop()` is one call with no children.
 *
 * Two consequences of serving rather than proxying:
 *
 * 1. every request is resolved *under* `buildDir`, both lexically and after
 *    `realpath`, and an escaping path is rejected — the server must not be a
 *    file-read primitive for `/etc/passwd` or for a symlink that points outside;
 * 2. navigation paths fall back to `index.html`, because the studio is a SPA and
 *    `/render?composition=...` exists only on the client. A missing asset is a
 *    404, not an HTML page with a 200.
 */

import { realpath } from "node:fs/promises";
import { normalize, resolve, sep } from "node:path";

/** The only interface this server listens on. */
const LOOPBACK = "127.0.0.1";

/** A running build server. `stop()` never throws; it is safe in `finally`. */
export type BuildServer = {
  /** Origin the server answers on, e.g. `http://127.0.0.1:4173`. */
  url: string;
  /** Port actually bound — differs from the requested one when it was `0`. */
  port: number;
  stop: () => void;
};

/**
 * Maps a request path onto a resolved real path inside `root`.
 *
 * Returns `null` when the path escapes the build directory, which covers `..`
 * segments, absolute paths and encoded variants (`%2e%2e%2f`) — decoding happens
 * *before* the containment check so encoding cannot smuggle a traversal past it.
 * The realpath check is separate because a symlink inside the root can point
 * anywhere; a lexical prefix test cannot see that.
 */
const resolveRequestPath = async (root: string, pathname: string): Promise<string | null> => {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    // Malformed percent-encoding: treat it as "not a file", not as a crash.
    return null;
  }

  // A NUL byte would truncate the path in the syscall that follows.
  if (decoded.includes("\0")) {
    return null;
  }

  // Strip leading separators: an absolute request path must still land under root.
  const relativePath = normalize(decoded).replace(/^[/\\]+/, "");
  const candidate = resolve(root, relativePath);

  if (candidate !== root && !candidate.startsWith(root + sep)) {
    return null;
  }

  try {
    const real = await realpath(candidate);

    if (real !== root && !real.startsWith(root + sep)) {
      return null;
    }

    return real;
  } catch {
    // Missing file, broken symlink, or unreadable parent: nothing to serve.
    return null;
  }
};

/** A last-segment dot means an asset request, not a client-side route. */
const looksLikeAsset = (pathname: string): boolean => {
  const segment = pathname.slice(pathname.lastIndexOf("/") + 1);

  return segment.includes(".");
};

/**
 * True for a browser navigation (or the root probe), false for fetches and
 * asset requests. Only navigations may receive the SPA fallback.
 */
const isNavigationRequest = (request: Request, pathname: string): boolean => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false;
  }

  // The root is always served, including the server's own startup probe, which
  // sends no browser Accept header.
  if (pathname === "/" || pathname.endsWith("/")) {
    return true;
  }

  if (looksLikeAsset(pathname)) {
    return false;
  }

  const accept = request.headers.get("accept") ?? "";

  return accept.includes("text/html") || request.headers.get("sec-fetch-mode") === "navigate";
};

/** Polls the origin until it answers, so callers cannot race the first request. */
const waitUntilAnswering = async (url: string, timeoutMs = 5_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/`);

      if (response.ok) {
        return;
      }
    } catch {
      // Not listening yet — Bun.serve binds asynchronously enough to matter here.
    }

    await Bun.sleep(50);
  }

  throw new Error(`build server did not answer on ${url} within ${timeoutMs}ms`);
};

/**
 * Serves `buildDir` over HTTP with SPA fallback.
 *
 * @param buildDir - Directory holding `index.html` and the client bundle
 * @param port - Port to bind; `0` asks the OS for a free one
 * @returns The origin, the bound port and a `stop()` that tears the server down
 */
export const serveBuild = async (buildDir: string, port = 4173): Promise<BuildServer> => {
  const lexicalRoot = resolve(buildDir);
  let root: string;

  try {
    // Resolve the root once so a symlinked build directory is compared against
    // real paths on both sides of the containment check.
    root = await realpath(lexicalRoot);
  } catch {
    root = lexicalRoot;
  }

  const indexFile = Bun.file(resolve(root, "index.html"));

  // Checked before binding. Without this the server starts happily, answers every
  // request with a 404 (or with nothing), and the failure surfaces later inside
  // the browser as "never reported ready" — a delayRender() bug that is not there.
  if (!(await indexFile.exists())) {
    throw new Error(`no studio build at ${root} — run \`vp run studio#build\` first`);
  }

  const server = Bun.serve({
    port,
    // Loopback only: this is a local render tool, and it serves a directory — it
    // has no business answering on the machine's other interfaces.
    hostname: LOOPBACK,
    fetch: async (request: Request): Promise<Response> => {
      const { pathname } = new URL(request.url);
      const candidate = pathname.endsWith("/") ? null : await resolveRequestPath(root, pathname);

      if (candidate !== null) {
        const file = Bun.file(candidate);

        // `Bun.file` sets Content-Type from the extension, which is why there is
        // no MIME table in this file. `exists()` also filters out directories.
        if (await file.exists()) {
          return new Response(file);
        }
      }

      // SPA fallback only for navigation. Handing `index.html` to a missing
      // `/chunk.js` would give the browser HTML with a 200 and fail much later.
      if (isNavigationRequest(request, pathname) && (await indexFile.exists())) {
        return new Response(indexFile);
      }

      return new Response("Not found", { status: 404 });
    },
  });

  // `port` is optional on Bun's `Server`; it is set as soon as the server binds.
  const boundPort = server.port ?? port;
  const url = `http://${LOOPBACK}:${boundPort}`;

  try {
    await waitUntilAnswering(url);
  } catch (error) {
    // The caller never receives the handle, so this server would keep the port
    // for the life of the process. Closing it here is the only chance.
    void server.stop(true);
    throw error;
  }

  return {
    url,
    port: boundPort,
    stop: () => {
      // `true` closes open connections too — a still-open keep-alive socket would
      // otherwise keep the port bound after the render finished.
      void server.stop(true);
    },
  };
};
