import { defineComposition } from "@svelte-motion/core";
import SvelteTransition from "./SvelteTransition.svelte";

export default defineComposition({
  id: "svelte-transition",
  component: SvelteTransition,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 90,
  defaultProps: {
    headline: "Built in Svelte",
    caption: "svelte/transition, driven by the frame",
  },
});
