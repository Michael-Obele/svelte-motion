/**
 * `@svelte-motion/renderer` — the Node/Bun half of svelte-motion.
 *
 * Browser code lives in `@svelte-motion/core`; this package drives a headless
 * browser and an FFmpeg process, so it must never be reachable from a browser
 * bundle. Nothing here imports core: the page is driven exclusively through the
 * `svelteMotion_*` globals it publishes.
 */

export { serveBuild, type BuildServer } from "./serve.ts";
export {
  captureFrame,
  getCompositionsFromPage,
  launchBrowser,
  openComposition,
  type FrameSize,
  type PageComposition,
} from "./browser.ts";
export { buildFfmpegArgs, checkFfmpeg, encodeWithFFmpeg, type EncodeOptions } from "./ffmpeg.ts";
