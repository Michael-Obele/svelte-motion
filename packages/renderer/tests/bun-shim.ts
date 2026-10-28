/**
 * Bun runtime shims — test-only, Node side.
 *
 * The renderer is Bun-native by decision: `Bun.serve` for the build server,
 * `Bun.file` for its responses, `Bun.spawn` for FFmpeg, `Bun.CryptoHasher` for
 * hashing. `vp test` starts Vitest on Node 24, where none of those exist.
 *
 * The alternative was a second, Node-shaped implementation of `serve.ts` and
 * `ffmpeg.ts` that would never ship and would be tested instead of the real
 * thing. Shimming the four globals is smaller and keeps the production code on
 * exactly one path. Under Bun these shims are never installed — `installBunShim()`
 * returns immediately when `Bun` is already there.
 *
 * Two implementation notes worth keeping:
 *
 * - `Bun.serve` must expose the bound port *synchronously*, because `serveBuild()`
 *   reads `server.port` on the very next line. Real Bun can; `node:http` cannot
 *   when it is told which host to bind, so the shim picks a loopback port itself
 *   rather than asking the OS for one. `pickDynamicPort()` explains the whole
 *   constraint — it is the least obvious code in this file.
 * - `Bun.file` returns a `Blob` with an `exists()` method. It has to be a real
 *   `Blob`, because `serve.ts` passes it straight to `new Response(file)` and the
 *   response derives its `Content-Type` from `blob.type`. That also means the MIME
 *   table below is load-bearing: the studio is ES modules, and a bundle served as
 *   `application/octet-stream` is refused by the browser.
 */

import { spawn as spawnChild } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";

/* -------------------------------------------------------------------------- */
/* Bun.file                                                                    */
/* -------------------------------------------------------------------------- */

const MIME: Readonly<Record<string, string>> = {
  ".css": "text/css",
  ".html": "text/html",
  ".ico": "image/x-icon",
  ".js": "text/javascript",
  ".json": "application/json",
  ".map": "application/json",
  ".mjs": "text/javascript",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".wasm": "application/wasm",
  ".webm": "video/webm",
  ".webmanifest": "application/manifest+json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const extensionOf = (path: string): string => {
  const dot = path.lastIndexOf(".");

  return dot === -1 ? "" : path.slice(dot).toLowerCase();
};

/** The slice of `BunFile` that `serve.ts` touches. */
type FileShim = Blob & { exists: () => Promise<boolean> };

const fileShim = (path: string): FileShim => {
  let bytes: Uint8Array | null;

  try {
    bytes = new Uint8Array(readFileSync(path));
  } catch {
    // Missing file or a directory — both mean "not servable".
    bytes = null;
  }

  // `slice()` narrows the backing store to a plain `ArrayBuffer`, which is what
  // `BlobPart` accepts — a `Buffer`/`ArrayBufferLike` view is rejected by TS 6.
  const parts: BlobPart[] = bytes === null ? [] : [bytes.slice().buffer];
  const blob = new Blob(parts, {
    type: MIME[extensionOf(path)] ?? "application/octet-stream",
  });

  return Object.assign(blob, { exists: async (): Promise<boolean> => bytes !== null });
};

/* -------------------------------------------------------------------------- */
/* Bun.serve                                                                   */
/* -------------------------------------------------------------------------- */

type ServeShimOptions = {
  port?: number;
  /** Defaults to loopback, matching the `hostname` the real `serveBuild()` passes. */
  hostname?: string;
  fetch: (request: Request) => Response | Promise<Response>;
};

type ServerShim = { port: number; stop: (force?: boolean) => void };

/**
 * Base for the ports the shim hands out when the caller asks for `0`.
 *
 * `node:http` only binds synchronously when it is given no host: a host goes
 * through `dns.lookup`, which is asynchronous even for a literal IP, and the bind
 * then happens on a later tick. `serveBuild()` reads `server.port` on the very
 * next line — real Bun can answer because it binds synchronously — so the shim
 * cannot wait for the `listening` event either. It therefore picks a concrete
 * loopback port up front instead of asking the OS for `0`. The range is the OS's
 * dynamic range, so no service port is squatted; the pid offset keeps two vitest
 * workers from handing out the same numbers; `waitUntilAnswering()` in `serve.ts`
 * already tolerates the few milliseconds the real bind takes.
 */
let nextDynamicPort = 49_152 + (process.pid % 1_000);

const pickDynamicPort = (): number => {
  nextDynamicPort = nextDynamicPort >= 61_000 ? 49_152 : nextDynamicPort + 1;

  return nextDynamicPort;
};

/**
 * Applies a single byte range to a full response body.
 *
 * Real `Bun.serve` answers a `Range` request against a `Bun.file` with a 206 on
 * its own. `node:http` does not, and a `<video>` element needs a 206 to seek —
 * without one Chromium silently keeps `currentTime` at zero. The video-seek e2e
 * test exercises the real `<Video>` path through this shim, so the shim has to
 * mirror that part of Bun's behaviour too.
 *
 * Only the single-range form media elements send (`bytes=start-`, `bytes=start-end`,
 * `bytes=-suffix`) is handled; a multi-range request falls through to the full
 * 200, which is legal for a server that does not support ranges.
 */
const applyByteRange = (
  request: import("node:http").IncomingMessage,
  status: number,
  headers: Record<string, string>,
  body: Uint8Array,
): { status: number; headers: Record<string, string>; body: Uint8Array } | undefined => {
  const range = request.headers.range;

  if (range === undefined || status !== 200 || body.length === 0) {
    return undefined;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());

  if (match === null) {
    return undefined;
  }

  const [, rawStart = "", rawEnd = ""] = match;

  if (rawStart === "" && rawEnd === "") {
    return undefined;
  }

  const total = body.length;
  let start = rawStart === "" ? total - Number(rawEnd) : Number(rawStart);
  let end = rawStart === "" || rawEnd === "" ? total - 1 : Number(rawEnd);

  start = Math.max(0, start);
  end = Math.min(end, total - 1);

  if (start > end) {
    return {
      status: 416,
      headers: { "content-range": `bytes */${total}` },
      body: new Uint8Array(0),
    };
  }

  return {
    status: 206,
    headers: {
      ...headers,
      "accept-ranges": "bytes",
      "content-length": String(end - start + 1),
      "content-range": `bytes ${start}-${end}/${total}`,
    },
    body: body.subarray(start, end + 1),
  };
};

const serveShim = (options: ServeShimOptions): ServerShim => {
  const requested = options.port ?? 0;
  const port = requested === 0 ? pickDynamicPort() : requested;

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      // Headers matter to `serve.ts`: SPA fallback keys off `Accept` and
      // `Sec-Fetch-Mode`, so dropping them here would make every navigation
      // look like an asset fetch.
      const requestHeaders = new Headers();

      for (const [name, value] of Object.entries(request.headers)) {
        if (value !== undefined) {
          requestHeaders.set(name, Array.isArray(value) ? value.join(", ") : value);
        }
      }

      const reply = await options.fetch(
        new Request(url, { method: request.method ?? "GET", headers: requestHeaders }),
      );
      const body = new Uint8Array(await reply.arrayBuffer());
      const headers = Object.fromEntries(reply.headers.entries());
      const ranged = applyByteRange(request, reply.status, headers, body);

      if (ranged !== undefined) {
        response.writeHead(ranged.status, ranged.headers);
        response.end(ranged.body);

        return;
      }

      response.writeHead(reply.status, headers);
      response.end(body);
    } catch (error) {
      // A thrown handler must not leave the socket hanging: the render would
      // wait for a response that never comes.
      response.writeHead(500, { "content-type": "text/plain" });
      response.end(error instanceof Error ? error.message : "handler failed");
    }
  });

  // Loopback by default: `node:http` binds every interface when no host is given,
  // which is exactly what the real server was changed to avoid. The bind itself
  // completes on a later tick — see `pickDynamicPort()` for why the port is known
  // anyway.
  server.listen(port, options.hostname ?? "127.0.0.1");

  return {
    port,
    stop: () => {
      // `Bun`'s `stop(true)` drops keep-alive sockets; `close()` alone would keep
      // the port bound and the test process alive.
      server.closeAllConnections();
      server.close();
    },
  };
};

/* -------------------------------------------------------------------------- */
/* Bun.spawn                                                                   */
/* -------------------------------------------------------------------------- */

type SpawnShimOptions = {
  stdin?: "pipe" | "ignore";
  stdout?: "ignore" | "inherit" | "pipe";
  stderr?: "pipe" | "ignore";
};

type SpawnShimResult = {
  stdin: {
    write: (chunk: Uint8Array) => void;
    flush: () => Promise<void>;
    end: () => Promise<void>;
  };
  exited: Promise<number>;
  kill: () => void;
  stdout: ReadableStream<Uint8Array>;
  stderr: ReadableStream<Uint8Array>;
};

const streamOf = (source: NodeJS.ReadableStream | null): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start: (controller) => {
      if (source === null) {
        controller.close();

        return;
      }

      source.on("data", (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });
      source.on("end", () => {
        controller.close();
      });
      source.on("error", (error: Error) => {
        controller.error(error);
      });
    },
  });

const spawnShim = (command: readonly string[], options: SpawnShimOptions = {}): SpawnShimResult => {
  const [executable, ...args] = command;

  if (executable === undefined) {
    throw new Error("spawn shim needs a command");
  }

  const child = spawnChild(executable, args, {
    stdio: [
      options.stdin === "ignore" ? "ignore" : "pipe",
      options.stdout === "pipe" ? "pipe" : (options.stdout ?? "ignore"),
      options.stderr === "ignore" ? "ignore" : "pipe",
    ],
  });

  const exited = new Promise<number>((resolve, reject) => {
    // A missing binary surfaces here, which is what `checkFfmpeg()` catches.
    child.on("error", reject);
    child.on("close", (code) => {
      resolve(code ?? 1);
    });
  });

  const childStdin = child.stdin;

  return {
    kill: () => {
      child.kill("SIGKILL");
    },
    stdin: {
      write: (chunk) => {
        childStdin?.write(chunk);
      },
      flush: async () => {
        if (childStdin === null || !childStdin.writableNeedDrain) {
          return;
        }

        // Real backpressure: without it the frame loop outruns FFmpeg.
        await once(childStdin, "drain");
      },
      end: async () => {
        if (childStdin === null) {
          return;
        }

        await new Promise<void>((resolve) => {
          childStdin.end(resolve);
        });
      },
    },
    exited,
    stdout: streamOf(child.stdout),
    stderr: streamOf(child.stderr),
  };
};

/* -------------------------------------------------------------------------- */
/* Bun.sleep, Bun.CryptoHasher                                                 */
/* -------------------------------------------------------------------------- */

const sleepShim = (milliseconds: number): Promise<void> =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

/** Same call shape as Bun's: `new CryptoHasher("sha256").update(x).digest("hex")`. */
class CryptoHasherShim {
  readonly #hash: ReturnType<typeof createHash>;

  constructor(algorithm: string) {
    this.#hash = createHash(algorithm);
  }

  update(data: Uint8Array | string): this {
    this.#hash.update(data);

    return this;
  }

  digest(): Uint8Array;
  digest(encoding: "hex" | "base64" | "base64url"): string;
  digest(encoding?: "hex" | "base64" | "base64url"): string | Uint8Array {
    if (encoding === undefined) {
      return new Uint8Array(this.#hash.digest());
    }

    return this.#hash.digest(encoding);
  }
}

/* -------------------------------------------------------------------------- */
/* install                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Installs the shims when the real Bun runtime is absent. Idempotent, and a
 * no-op under Bun.
 */
export const installBunShim = (): void => {
  const target = globalThis as unknown as { Bun?: unknown };

  if (target.Bun !== undefined) {
    return;
  }

  target.Bun = {
    CryptoHasher: CryptoHasherShim,
    file: fileShim,
    serve: serveShim,
    sleep: sleepShim,
    spawn: spawnShim,
  };
};
