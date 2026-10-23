import { defineComposition } from "@svelte-motion/core";
import HelloWorld from "./HelloWorld.svelte";

/**
 * Every `src/compositions/<name>/index.ts` default-exports one of these. The
 * render host discovers them with an app-owned `import.meta.glob`.
 */
export default defineComposition({
  id: "hello-world",
  component: HelloWorld,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 90,
  defaultProps: { title: "Hello Svelte Motion" },
});
