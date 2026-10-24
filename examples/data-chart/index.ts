import { defineComposition } from "@svelte-motion/core";
import * as v from "valibot";
import DataChart from "./DataChart.svelte";

export default defineComposition({
  id: "data-chart",
  component: DataChart,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 150,
  defaultProps: {
    heading: "Monthly renders",
  },
  schema: v.object({
    heading: v.pipe(v.string(), v.minLength(1)),
  }),
});
