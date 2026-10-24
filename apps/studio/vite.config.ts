import tailwindcss from "@tailwindcss/vite";
import { sveltekit } from "@sveltejs/kit/vite";
import adapter from "@sveltejs/adapter-static";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite-plus";
import { lazyPlugins } from "vite-plus";

export default defineConfig({
  resolve: {
    alias: {
      // The `examples/` folder lives outside this app's root, so bun never links
      // `@svelte-motion/core` into a `node_modules` the resolver can see from
      // there. Point it at core's source: the studio then always reflects the
      // library it ships with, and there is no stale `dist` to forget to rebuild.
      "@svelte-motion/core": fileURLToPath(
        new URL("../../packages/core/src/lib/index.ts", import.meta.url),
      ),
      // Same reason: `examples/data-chart` imports valibot for its props schema.
      // `import.meta.resolve` picks the ESM entry, not the CJS one.
      valibot: fileURLToPath(import.meta.resolve("valibot")),
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
