// Client-only on purpose: the gallery drives frames in the browser, and the render
// hosts must be screenshot-able without a server. `adapter-static`'s
// `fallback: "index.html"` serves this single shell for every path.
export const prerender = false;
export const ssr = false;
