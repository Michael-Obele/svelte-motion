# AGENTS.md — Agent & Contributor Guide

> Internal working docs live in `plan/` (gitignored). Canonical copy: `AI-Plans/plans/svelte-motion/`.
> This file is the public index for agents and contributors. Do not duplicate `plan/` contents in `README.md`.

## Why `plan/` is gitignored

`plan/` is a working spec — it changes faster than the product and would churn the main history. The repo `.gitignore` excludes it on purpose:

```gitignore
# The plan. Kept out of version control on purpose: it is a working document,
# and the canonical copy lives in AI-Plans/plans/svelte-motion/.
plan/
```

If you need the full spec, read the canonical copy at `AI-Plans/plans/svelte-motion/` or the local `plan/` folder if present. `AGENTS.md` is the only file in the main repo that indexes it.

## Document map

| Doc                         | What it answers                                         | When to open it                                     |
| --------------------------- | ------------------------------------------------------- | --------------------------------------------------- |
| `plan/README.md`            | Human door — summary, deliverables, next steps          | You need the 30-second overview                     |
| `plan/research.md`          | Verified facts + sources, React vs Svelte answer        | You need a verified fact or a source                |
| `plan/architecture.md`      | Components, module layout, frame runtime, failure modes | You need components, data flow, or interfaces       |
| `plan/svelte-mapping.md`    | Exact React → Svelte 5 API translation                  | You need the Remotion → Svelte API table            |
| `plan/rendering.md`         | Headless Chrome + FFmpeg pipeline, determinism, CLI     | You need the render pipeline or concurrency rules   |
| `plan/decisions.md`         | 14 decisions, 10 risks, open questions                  | You need why a choice was made or what was rejected |
| `plan/milestones.md`        | M0–M6 with commands and done-when gates                 | You need the next task and its gate                 |
| `plan/repomix/remotion.xml` | Full Remotion source, 12,733 files, 9.8M tokens, XML    | You need Remotion internals verbatim                |

## Architecture at a glance

```
Author writes Svelte composition (frame -> pixels)
  -> Vite 6 + SvelteKit 2 bundles to browser JS
  -> dev: SvelteKit dev server + Studio (scrubber, timeline)
  -> render: Playwright launches headless Chromium
           -> for frame 0..N: set frame, wait ready, screenshot PNG
           -> FFmpeg via Bun.spawn stitches PNGs to MP4
```

Module layout (product repo, scaffolded with `bunx sv create`):

```
src/lib/motion/      # context.svelte.ts, config.ts, composition.ts, ready.ts, asset.ts
src/lib/timeline/    # Sequence.svelte, Series.svelte, Loop.svelte, Freeze.svelte
src/lib/math/        # interpolate.ts, spring.ts, easing.ts (pure TS, no Svelte dep)
src/lib/player/      # Player.svelte, PlayerControls.svelte
src/lib/renderer/    # browser.ts, ffmpeg.ts, render.ts, assets.ts
src/lib/studio/      # Timeline.svelte, Scrubber.svelte, Preview.svelte
compositions/        # user videos — each a .svelte file + defineComposition entry
```

See `plan/architecture.md` for the full component table, interfaces, and failure modes.

## Decisions (settled)

- **D1** Start clean from `bunx sv create`, copy MIT math helpers only — don't fork `svelte-in-motion`.
- **D2** Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props`, snippets).
- **D3** SvelteKit + Vite 6 (routing, adapters, `adapter-static` for render).
- **D4** Vite for bundling, not Webpack.
- **D5** `delayRender`/`continueRender` + `ready` boolean (same counter, two APIs).
- **D6** Playwright over Puppeteer (multi-browser, stable screenshot API).
- **D7** `Bun.spawn` for FFmpeg (stdin streaming).
- **D8** Valibot for props validation (Zod accepted as alternative).

Open questions live in `plan/decisions.md`: SvelteKit 2 vs 3 at scaffold time, Studio timeline scope, system FFmpeg vs shipped binaries, Zod acceptance.

## Rendering pipeline (determinism is the gate)

1. **Bundle** — `bun run build` via Vite + `vite-plugin-svelte` + `adapter-static` to `build/`.
2. **Serve** — `bun run preview -- --port 4173` on a dedicated port (no HMR).
3. **Capture** — Playwright `page.goto('...?composition=id&frame=N')` → wait `svelteMotion_ready()` + `document.fonts.ready` + `networkidle` → `page.screenshot({ clip })`.
4. **Encode** — `Bun.spawn` FFmpeg: `ffmpeg -framerate 30 -i frame%04d.png -c:v libx264 -pix_fmt yuv420p out.mp4`.

Rules: frames must be pure functions of `frame` (no `Math.random`/`Date.now`), `window.svelteMotion_*` globals drive the renderer, kill the server in `finally`.

See `plan/rendering.md` for concurrency, asset prefetch, and `delayRender` timeout handling.

## Svelte 5 mapping (React → Svelte)

| Remotion                   | Svelte Motion                                | Notes                                            |
| -------------------------- | -------------------------------------------- | ------------------------------------------------ |
| `useCurrentFrame()`        | `getMotionContext().frame` (`$state`)        | Same name, rune-backed                           |
| `useVideoConfig()`         | `useVideoConfig()`                           | `{fps, width, height, durationInFrames}`         |
| `<Sequence from duration>` | `<Sequence from durationInFrames>` + snippet | `localFrame = globalFrame - sum(from ancestors)` |
| `<Series>`                 | `<Series>`                                   | Computes `from` cumulatively                     |
| `<Loop>` / `<Freeze>`      | `<Loop>` / `<Freeze>`                        | `frame % duration` / pinned frame                |
| `Composition`              | `defineComposition` + `import.meta.glob`     | Registry via Vite glob                           |
| `interpolate`/`spring`     | `interpolate`/`spring`                       | Pure TS, copied verbatim                         |
| `delayRender`              | `delayRender` + `ready`                      | Counter-based, renderer polls                    |

See `plan/svelte-mapping.md` for the full table and snippet examples.

## Milestones (M0–M6)

| Milestone | Title                | Gate                                                                                  |
| --------- | -------------------- | ------------------------------------------------------------------------------------- |
| M0        | Recon and the spike  | Same component screenshots identically at frame 0 and 90, determinism holds           |
| M1        | Math and timeline    | `interpolate`/`spring`/`Sequence` match Remotion output, tests pass                   |
| M2        | Renderer CLI         | `svelte-motion render hello-world --out out.mp4` produces 3s MP4, frame count matches |
| M3        | Assets and readiness | Font-heavy composition with `delayRender` renders without blank frames                |
| M4        | Player               | `Player` plays at `fps` with scrubber, preview matches renderer PNG                   |
| M5        | Studio               | Composition picker, preview, scrubber, timeline with nesting                          |
| M6        | Polish, docs, skills | Docs, agent skills, Valibot props, CLI help, `bun test` pass                          |

See `plan/milestones.md` for commands and done-when checklists.

## Working agreements for agents

- Read `plan/README.md` first, then the specific doc for your task — don't guess from `README.md` alone.
- Keep `plan/` out of commits. Update `AGENTS.md` if the index drifts.
- Frame runtime is the single source of truth: `frame` as `$state`, derived values as `$derived`, never assign to `$state` inside `$effect` for frame math.
- Determinism gate blocks everything: no wall clock, no randomness in compositions.
- Prefer `Bun.spawn` and Valibot per stack decisions; document any deviation in `plan/decisions.md`.

## Where to look next

- Product code (when scaffolded): `src/lib/motion/context.svelte.ts`, `src/lib/timeline/Sequence.svelte`, `src/lib/renderer/render.ts`
- Full Remotion source (read-only reference): `plan/repomix/remotion.xml`
- Public overview: `README.md`
