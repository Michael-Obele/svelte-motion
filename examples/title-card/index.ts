import { defineComposition } from "@svelte-motion/core";
import TitleCard from "./TitleCard.svelte";

export default defineComposition({
  id: "title-card",
  component: TitleCard,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 90,
  defaultProps: {
    title: "Svelte Motion",
    subtitle: "Videos as components",
  },
});
