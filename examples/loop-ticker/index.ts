import { defineComposition } from "@svelte-motion/core";
import LoopTicker from "./LoopTicker.svelte";

export default defineComposition({
  id: "loop-ticker",
  component: LoopTicker,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 120,
  defaultProps: {
    heading: "Built with",
    items: ["Svelte 5", "Vite+", "Bun", "Playwright", "FFmpeg"],
  },
});
