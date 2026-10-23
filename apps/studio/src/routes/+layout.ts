// The render host is client-only on purpose: nothing here should be server-rendered,
// and nothing should be prerendered into per-route HTML. `adapter-static`'s
// `fallback: "index.html"` serves this single shell for every path.
export const prerender = false;
export const ssr = false;
