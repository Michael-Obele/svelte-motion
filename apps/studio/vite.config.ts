import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import adapter from "@sveltejs/adapter-static";
import { defineConfig } from "vite-plus";
import { lazyPlugins } from "vite-plus";

export default defineConfig({
  plugins: lazyPlugins(() => [
    tailwindcss(),
    sveltekit({
      compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
      },

      // The studio is a render host, not a deployed site: every route is client-only
      // (see `src/routes/+layout.ts`), so the build emits one SPA fallback that
      // `vite preview` serves for any path. That is what lets the M2 renderer ask for
      // `/render?composition=<id>&frame=<n>` without a per-frame HTML file.
      adapter: adapter({ fallback: "index.html" }),
    }),
  ]),
});
