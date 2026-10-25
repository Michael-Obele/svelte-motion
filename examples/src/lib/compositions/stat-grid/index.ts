import { defineComposition } from "@svelte-motion/core";
import StatGrid from "./StatGrid.svelte";

export default defineComposition({
  id: "stat-grid",
  component: StatGrid,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 120,
  defaultProps: {
    heading: "This quarter",
  },
});
