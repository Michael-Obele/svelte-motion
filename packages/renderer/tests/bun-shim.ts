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
 *   reads `server.port` on the very next line. `node:http` binds a numeric port
 *   synchronously, so `listen(0)` followed by `address()` already answers — only
 *   the `listening` event is deferred.
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
import type { AddressInfo } from "node:net";

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
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain",
  ".wasm": "application/wasm",
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
  fetch: (request: Request) => Response | Promise<Response>;
};

type ServerShim = { port: number; stop: (force?: boolean) => void };

const serveShim = (options: ServeShimOptions): ServerShim => {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      const reply = await options.fetch(new Request(url, { method: request.method ?? "GET" }));
      const body = new Uint8Array(await reply.arrayBuffer());

      response.writeHead(reply.status, Object.fromEntries(reply.headers.entries()));
      response.end(body);
    } catch (error) {
      // A thrown handler must not leave the socket hanging: the render would
      // wait for a response that never comes.
      response.writeHead(500, { "content-type": "text/plain" });
      response.end(error instanceof Error ? error.message : "handler failed");
    }
  });

  server.listen(options.port ?? 0);

  // Bound synchronously — `serveBuild()` reads `.port` before any await.
  const boundPort = (server.address() as AddressInfo | null)?.port;

  if (boundPort === undefined) {
    throw new Error("serve shim: the listening socket never bound");
  }

  return {
    port: boundPort,
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
