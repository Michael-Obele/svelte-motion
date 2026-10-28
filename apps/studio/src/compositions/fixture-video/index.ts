import { defineComposition } from "@svelte-motion/core";
import FixtureVideo from "./FixtureVideo.svelte";

/**
 * Test-only composition: a single `<Video>` whose pixels change with the seek.
 * `render.e2e.test.ts` writes the referenced WebM into the build directory
 * before it renders, so the same source tree works on a clean checkout.
 */
export default defineComposition({
  id: "fixture-video",
  component: FixtureVideo,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 60,
  defaultProps: { src: "fixture-video-seek.webm" },
});
