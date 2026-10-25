import { defineComposition } from "@svelte-motion/core";
import ImageGallery from "./ImageGallery.svelte";

export default defineComposition({
  id: "image-gallery",
  component: ImageGallery,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 120,
  defaultProps: {},
});
