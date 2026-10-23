import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    // `tsgo` (TypeScript-Go) only exists for the experimental TypeScript 7 line. This
    // workspace pins TypeScript 6 to satisfy SvelteKit 3's peer range, so declarations
    // come from the standard generator — which is also the typed `dts` option.
    dts: true,
    exports: true,
  },
});
