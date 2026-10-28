<script lang="ts">
  /**
   * IFrame that participates in the readiness handshake.
   *
   * Holds the renderer until `load` fires. Cross-origin iframes may paint
   * non-deterministically; prefer same-origin content in rendered compositions.
   */
  import { onDestroy, untrack } from "svelte";
  import { continueRender, delayRender } from "../motion/ready.js";
  import { staticFile } from "../motion/asset.js";
  import type { IFrameProps } from "./media.js";

  let { src, style = "", onload, onerror, ...rest }: IFrameProps = $props();

  const resolvedSrc = $derived.by(() => {
    try {
      return staticFile(src);
    } catch {
      return src;
    }
  });

  // Plain `let`, not `$state`: imperative bookkeeping for the non-reactive
  // handle set in `ready.ts`, never rendered.
  let handle: number | null = null;
  let settled = false;

  const settle = () => {
    if (settled) return;
    settled = true;
    if (handle !== null) continueRender(handle);
  };

  handle = delayRender(`<IFrame src="${untrack(() => resolvedSrc)}">`);
  settled = false;

  const onLoad = (event: Event) => {
    settle();
    onload?.(event);
  };

  const onError = (event: Event) => {
    console.warn(`[svelte-motion] iframe failed to load: ${untrack(() => resolvedSrc)}`);
    settle();
    onerror?.(event);
  };

  let lastSrc = untrack(() => resolvedSrc);
  $effect(() => {
    void resolvedSrc;
    const current = resolvedSrc;
    if (current === lastSrc) return;
    lastSrc = current;
    if (!settled && handle !== null) continueRender(handle);
    handle = delayRender(`<IFrame src="${current}">`);
    settled = false;
  });

  onDestroy(() => {
    settle();
  });
</script>

<iframe src={resolvedSrc} {style} onload={onLoad} onerror={onError} {...rest}></iframe>
