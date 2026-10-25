import { defineComposition } from "@svelte-motion/core";
import LowerThird from "./LowerThird.svelte";

export default defineComposition({
  id: "lower-third",
  component: LowerThird,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 120,
  defaultProps: {
    name: "Ada Lovelace",
    role: "Composer of algorithms",
  },
});
