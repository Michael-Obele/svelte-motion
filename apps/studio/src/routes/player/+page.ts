// The player host reads `?composition`, `?frame` and `?props` from the browser, so
// there is nothing to render on the server. Inherited from `routes/+layout.ts`,
// restated here because this is the route where it actually matters.
export const ssr = false;
