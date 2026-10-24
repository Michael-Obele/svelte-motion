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

  let { src, style = "", ...rest }: IFrameProps = $props();

  const resolvedSrc = $derived.by(() => {
    try {
      return staticFile(src);
    } catch {
      return src;
    }
  });

  let handle: number | null = $state(null);
  let settled = $state(false);

  const settle = () => {
    if (settled) return;
    settled = true;
    if (handle !== null) continueRender(handle);
  };

  handle = delayRender(`<IFrame src="${untrack(() => resolvedSrc)}">`);
  settled = false;

  const onLoad = () => settle();

  const onError = () => {
    console.warn(`[svelte-motion] iframe failed to load: ${untrack(() => resolvedSrc)}`);
    settle();
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
