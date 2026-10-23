/**
 * Readiness handshake.
 *
 * The renderer must not screenshot a frame until fonts have loaded and every
 * asset the frame needs has arrived. Remotion solves this with a counter:
 * `delayRender()` bumps it, `continueRender(handle)` decrements it, and the
 * renderer waits until it reaches zero.
 *
 * Handles are a `Set` rather than a number so a double `continueRender` cannot
 * drive the counter negative — that bug produces silent blank frames.
 */

const handles = new Set<number>();
const waiters = new Set<() => void>();
const pendingLabels = new Map<number, string>();

let nextHandle = 0;

/**
 * Blocks the renderer until the returned handle is continued.
 *
 * @param label - Shown in the timeout error so you can find the culprit
 * @returns A handle to pass to `continueRender`
 */
export const delayRender = (label = "delayRender()"): number => {
  const handle = ++nextHandle;
  handles.add(handle);
  pendingLabels.set(handle, label);

  return handle;
};

/** Releases a handle from `delayRender`. Idempotent. */
export const continueRender = (handle: number): void => {
  if (!handles.delete(handle)) {
    return;
  }

  pendingLabels.delete(handle);

  if (handles.size === 0) {
    for (const waiter of waiters) {
      waiter();
    }

    waiters.clear();
  }
};

/** True when nothing is blocking the renderer. */
export const isReady = (): boolean => handles.size === 0;

/** Labels of the handles still blocking the renderer. */
export const getPendingLabels = (): string[] => [...pendingLabels.values()];

/** Resolves once every open handle has been continued. */
export const waitForReady = (): Promise<void> => {
  if (isReady()) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    waiters.add(resolve);
  });
};

/** Drops every handle. Test-only escape hatch; never call this mid-render. */
export const resetReadiness = (): void => {
  handles.clear();
  pendingLabels.clear();
  waiters.clear();
};

/** Installs `window.svelteMotion_ready`, which the renderer polls. */
export const installReadinessGlobal = (): void => {
  if (typeof window === "undefined") {
    return;
  }

  (window as unknown as Record<string, unknown>).svelteMotion_ready = isReady;
};
