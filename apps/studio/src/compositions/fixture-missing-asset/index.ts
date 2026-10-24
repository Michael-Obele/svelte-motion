import { defineComposition } from "@svelte-motion/core";
import FixtureMissingAsset from "./FixtureMissingAsset.svelte";

export default defineComposition({
  id: "fixture-missing-asset",
  component: FixtureMissingAsset,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 30,
});
