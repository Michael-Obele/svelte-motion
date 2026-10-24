import { defineComposition } from "@svelte-motion/core";
import FixtureStuck from "./FixtureStuck.svelte";

export default defineComposition({
  id: "fixture-stuck",
  component: FixtureStuck,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 30,
});
