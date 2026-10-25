<script lang="ts">
  /**
   * Image that participates in the readiness handshake.
   *
   * Holds the renderer until `load` or `error` fires, then releases exactly
   * once (idempotent per the `ready.ts` contract). Errors warn and continue
   * so a missing asset never hangs the render.
   */
  import { onDestroy, untrack } from "svelte";
  import { continueRender, delayRender } from "../motion/ready.js";
  import { staticFile } from "../motion/asset.js";
  import type { ImgProps } from "./media.js";

  let { src, alt = "", style = "", ...rest }: ImgProps = $props();

  const resolvedSrc = $derived.by(() => {
    try {
      return staticFile(src);
    } catch {
      return src;
    }
  });

  // Plain `let`, not `$state`: these are imperative bookkeeping for the
  // non-reactive handle set in `ready.ts`, never rendered. A `$state` write
  // inside the `$effect` below — which also reads them — would dirty itself.
  let handle: number | null = null;
  let settled = false;

  const settle = () => {
    if (settled) return;
    settled = true;
    if (handle !== null) continueRender(handle);
  };

  // Open a handle at init. Each mount gets its own handle; unmount without
  // load/error still clears it via onDestroy.
  handle = delayRender(`<Img src="${untrack(() => resolvedSrc)}">`);
  settled = false;

  const onLoad = () => settle();

  const onError = () => {
    console.warn(`[svelte-motion] image failed to load: ${untrack(() => resolvedSrc)}`);
    settle();
  };

  // If src changes, reopen the handle for the new asset.
  let lastSrc = untrack(() => resolvedSrc);
  $effect(() => {
    void resolvedSrc;
    const current = resolvedSrc;
    if (current === lastSrc) return;
    lastSrc = current;
    // Previous handle already settled or will be via events; open a fresh one.
    if (!settled && handle !== null) continueRender(handle);
    handle = delayRender(`<Img src="${current}">`);
    settled = false;
  });

  onDestroy(() => {
    settle();
  });
</script>

<img src={resolvedSrc} {alt} {style} onload={onLoad} onerror={onError} {...rest} />
