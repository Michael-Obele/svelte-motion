import tailwindcss from "@tailwindcss/vite";
import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig, lazyPlugins } from "vite-plus";

/**
 * The examples app.
 *
 * Deliberately ordinary: this is the setup a user writes after
 * `bun add @svelte-motion/core` — Kit, Vite, Tailwind, and the adapter. There is no
 * alias into another package's source here, so `@svelte-motion/core` resolves through
 * its real `exports` map to `dist`. That is the point of this app: if the published
 * entry points break, this build breaks. `apps/studio` does the opposite on purpose,
 * aliasing core to source so authoring never hits a stale build.
 *
 * `adapter-static` + `fallback: "index.html"` because the gallery is a client-only
 * SPA and the `/render` and `/player` routes must be screenshot-able by a headless
 * browser with no server behind them.
 */
export default defineConfig({
  plugins: lazyPlugins(() => [
    tailwindcss(),
    sveltekit({
      compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
      },
      adapter: adapter({ fallback: "index.html" }),
    }),
  ]),
});
