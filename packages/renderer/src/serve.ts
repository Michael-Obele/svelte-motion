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
 * 1. every request is resolved *under* `buildDir` and an escaping path is
 *    rejected — the server must not be a file-read primitive for `/etc/passwd`;
 * 2. unknown paths fall back to `index.html`, because the studio is a SPA and
 *    `/render?composition=...` exists only on the client.
 */

import { normalize, resolve, sep } from "node:path";

/** A running build server. `stop()` never throws; it is safe in `finally`. */
export type BuildServer = {
  /** Origin the server answers on, e.g. `http://localhost:4173`. */
  url: string;
  /** Port actually bound — differs from the requested one when it was `0`. */
  port: number;
  stop: () => void;
};

/**
 * Maps a request path onto a path inside `buildDir`.
 *
 * Returns `null` when the path escapes the build directory, which covers `..`
 * segments, absolute paths and encoded variants (`%2e%2e%2f`) — decoding happens
 * *before* the containment check so encoding cannot smuggle a traversal past it.
 */
const resolveRequestPath = (buildDir: string, pathname: string): string | null => {
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

  const root = resolve(buildDir);
  // Strip leading separators: an absolute request path must still land under root.
  const relativePath = normalize(decoded).replace(/^[/\\]+/, "");
  const candidate = resolve(root, relativePath);

  if (candidate !== root && !candidate.startsWith(root + sep)) {
    return null;
  }

  return candidate;
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
  const root = resolve(buildDir);
  const indexFile = Bun.file(resolve(root, "index.html"));

  const server = Bun.serve({
    port,
    fetch: async (request: Request): Promise<Response> => {
      const { pathname } = new URL(request.url);
      const candidate = pathname.endsWith("/") ? null : resolveRequestPath(root, pathname);

      if (candidate !== null) {
        const file = Bun.file(candidate);

        // `Bun.file` sets Content-Type from the extension, which is why there is
        // no MIME table in this file. `exists()` also filters out directories.
        if (await file.exists()) {
          return new Response(file);
        }
      }

      // SPA fallback: the router runs in the browser, so any unknown path is a
      // client route (`/render`) rather than a missing file.
      if (await indexFile.exists()) {
        return new Response(indexFile);
      }

      return new Response("Not found", { status: 404 });
    },
  });

  // `port` is optional on Bun's `Server`; it is set as soon as the server binds.
  const boundPort = server.port ?? port;
  const url = `http://localhost:${boundPort}`;
  await waitUntilAnswering(url);

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
