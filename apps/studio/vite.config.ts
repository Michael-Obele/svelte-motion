import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import adapter from "@sveltejs/adapter-static";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";
import { lazyPlugins } from "vite-plus";

export default defineConfig({
  resolve: {
    alias: {
      // App compositions and the shared Studio surfaces resolve `@svelte-motion/core`
      // to its source, not its `dist`. That keeps the preview honest — what you see is
      // the library you are editing, with no stale build to forget about. The examples
      // app deliberately does the opposite (it installs the package) so the published
      // entry points get exercised.
      "@svelte-motion/core": fileURLToPath(
        new URL("../../packages/core/src/lib/index.ts", import.meta.url),
      ),
    },
  },
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
