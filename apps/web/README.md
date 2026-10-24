# Web

Landing and docs shell for svelte-motion. A minimal SvelteKit app that links to the Studio and the GitHub repo.

## What it is

A single page at `/` with a heading, a short description, and links to GitHub and Studio docs. No compositions, no renderer, no player. It exists so the monorepo has a place for marketing and documentation that is separate from the Studio.

## Run

```bash
vp run web#dev
# SvelteKit dev server, default http://localhost:5173 (or next free port if Studio is running)
vp run web#build
# Static build to apps/web/build
```

## Structure

```
apps/web/
  src/
    routes/
      +page.svelte    # Landing page
      +layout.svelte  # Root layout
    app.css           # Tailwind entry
    app.html          # HTML shell
  static/
    robots.txt
  vite.config.ts      # SvelteKit + Tailwind + adapter-auto
```

## Styling

Tailwind CSS v4 with `@tailwindcss/vite`, same as Studio. The web app is the other place Tailwind is used. `@svelte-motion/core` has no Tailwind dependency.

## License

MIT
