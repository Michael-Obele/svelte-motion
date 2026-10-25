/**
 * `@svelte-motion/studio-ui` — the reusable Studio surfaces.
 *
 * A component library, not an app. Nothing here imports `$app/*`, so any
 * SvelteKit app can mount these: each app owns its routes, URL and globs, and
 * hands the resolved values down as props. SvelteKit's Packaging → Best
 * practices section asks for exactly this shape ("pass in things like the
 * current URL or a navigation action as a prop… makes it easier to set up tools
 * for testing, UI demos and so on").
 *
 * Two apps mount it today:
 *
 * - `apps/studio` — its own fixtures, plus the `/render` and `/player` hosts the
 *   determinism and parity gates screenshot.
 * - `examples` — the seven shipped examples, in the app a user would write.
 *
 * This package is private and consumed from source (`exports` points at
 * `src/lib/index.ts`), so editing a component is picked up by both apps with no
 * rebuild step. It is deliberately *not* published; the published engine is
 * `@svelte-motion/core`.
 */

/* -------------------------------------------------------------------------- */
/* Composition picker + preview (the Studio itself)                            */
/* -------------------------------------------------------------------------- */

export { default as Studio } from "./Studio.svelte";

/* -------------------------------------------------------------------------- */
/* Pixel hosts                                                                 */
/*                                                                             */
/* Routes cannot live in a package, so each app keeps a three-line route that   */
/* reads its own URL and renders one of these. That is the whole reason these   */
/* are components: one implementation, two servers.                             */
/* -------------------------------------------------------------------------- */

export { default as PlayerHost } from "./PlayerHost.svelte";
export { default as RenderHost } from "./RenderHost.svelte";

/**
 * `?frame=` / `?props=` resolution shared by both hosts, so the two pixel
 * surfaces can never disagree about what they were asked to draw.
 */
export { resolveHostProps, type QueryParams, type ResolvedHostProps } from "./host-params.ts";

/* -------------------------------------------------------------------------- */
/* Display helpers                                                             */
/* -------------------------------------------------------------------------- */

export { clampFrame, formatDuration } from "./format.ts";
