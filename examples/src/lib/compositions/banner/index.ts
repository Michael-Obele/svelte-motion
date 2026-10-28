import { defineComposition } from "@svelte-motion/core";
import Banner from "./Banner.svelte";

/**
 * The banner artwork, animated for the landing page.
 *
 * 1280×400 is the artwork's own size, which is also the GIF branch's width
 * ceiling — so this renders at 1:1 and 15 fps (30 source frames halved by the
 * GIF filter) without being resized or resampled.
 */
export default defineComposition({
  id: "banner",
  component: Banner,
  width: 1280,
  height: 400,
  fps: 30,
  durationInFrames: 90,
});
