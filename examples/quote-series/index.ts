import { defineComposition } from "@svelte-motion/core";
import QuoteSeries from "./QuoteSeries.svelte";

export default defineComposition({
  id: "quote-series",
  component: QuoteSeries,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 150,
  defaultProps: {
    line1: "The most dangerous phrase",
    line2: "in the language is",
    line3: "we have always done it this way.",
    author: "Grace Hopper",
    role: "Rear Admiral, US Navy",
  },
});
