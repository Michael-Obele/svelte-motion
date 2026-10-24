import { defineComposition } from "@svelte-motion/core";
import * as v from "valibot";
import FixtureFontHeavy from "./FixtureFontHeavy.svelte";

export default defineComposition({
  id: "fixture-font-heavy",
  component: FixtureFontHeavy,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 60,
  defaultProps: { title: "Fixture Font Heavy" },
  schema: v.object({ title: v.pipe(v.string(), v.minLength(1)) }),
});
