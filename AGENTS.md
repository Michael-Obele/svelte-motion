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
  -> Vite+ 1.4 (via @voidzero-dev/vite-plus-core 1.4.0) + SvelteKit 3.1 + Bun 1.4.4 bundles to browser JS
  -> dev: SvelteKit dev server + Studio (scrubber, timeline)
  -> render: Playwright launches headless Chromium
           -> for frame 0..N: set frame, wait ready, screenshot PNG
           -> FFmpeg via Bun.spawn stitches PNGs to MP4
```

Module layout — a Vite+ workspace with Bun workspaces, scaffolded by the `vp` CLI:

```
packages/core/       # @svelte-motion/core      browser-only: motion/, timeline/, math/, player/
                     #                          built with svelte-package (tsdown cannot compile .svelte)
packages/renderer/   # @svelte-motion/renderer  node-only: browser.ts, ffmpeg.ts, render.ts, assets.ts
packages/cli/        # @svelte-motion/cli       bin; standalone executable later via pack.exe
apps/studio/         # SvelteKit dev server: Timeline, Scrubber, Preview
apps/web/            # homepage + docs (SvelteKit + shadcn-svelte)
examples/            # compositions consumed by studio, docs, and renderer tests
```

The split is a hard boundary, not tidiness: the renderer shells out to Playwright and FFmpeg, so
it must never be reachable from a browser bundle. `core` stays free of Node built-ins; anything
that needs the filesystem belongs in `renderer`.

Workspace commands (`vp` is Vite+, `vpr` is `vp run`):

```bash
vp run -r build        # recursive, cache-aware build of every member
vp run studio#dev      # one member by package name
vp -C apps/studio dev  # one member by directory
vp check               # fmt + lint + typecheck across the workspace
vp run -r test         # every member's tests (cached)
vp run studio#build    # build the Studio for rendering
SM_E2E=1 vp test       # per-package e2e, run inside the package dir (vp run cache ignores env vars)
bun run tools/spike/verify-determinism.ts  # M0 determinism gate
bun run tools/spike/verify-player-parity.ts  # M4 player parity gate
```

`vp check` and `vp fmt` read lint/format settings **only** from the root `vite.config.ts`;
per-package `lint`/`fmt` blocks are ignored, so package-specific rules belong in `overrides`.

See `plan/architecture.md` for the full component table, interfaces, and failure modes.

## Decisions (settled)

- **D1** Start clean from `bunx sv create`, copy MIT math helpers only — don't fork `svelte-in-motion`.
- **D2** Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props`, snippets).
- **D3** SvelteKit 3.1 + Vite+ 1.4 + Bun 1.4.4 (routing, adapters, `adapter-static` for render). Confirmed at scaffold, not Vite 6 or SvelteKit 2.
- **D4** Vite for bundling, not Webpack.
- **D5** `delayRender`/`continueRender` + `ready` boolean (same counter, two APIs).
- **D6** Playwright over Puppeteer (multi-browser, stable screenshot API).
- **D7** `Bun.spawn` for FFmpeg (stdin streaming).
- **D8** Valibot for props validation (Zod accepted as alternative).
- **D15** Vite+ (`vp`) monorepo on Bun workspaces, five members, `@svelte-motion/*` scope — supersedes D11. See `plan/decisions.md` for the scaffold-time version findings.

Open questions live in `plan/decisions.md`: Studio timeline scope, system FFmpeg vs shipped binaries, Zod acceptance.
SvelteKit version is settled: **3.1.0** (D15), not the D9 dual-path.

## Rendering pipeline (determinism is the gate)

1. **Bundle** — `vp run studio#build` via Vite + `vite-plugin-svelte` + `adapter-static` to `apps/studio/build/`.
2. **Serve** — `Bun.serve` on `127.0.0.1` with SPA fallback to `index.html` (no HMR, no `vite preview`).
3. **Capture** — Playwright `page.goto('.../render?composition=id&frame=N')` → wait `svelteMotion_ready()` + `document.fonts.ready` → `page.screenshot({ clip })`.
4. **Encode** — `Bun.spawn` FFmpeg image2pipe: `ffmpeg -framerate 30 -f image2pipe -vcodec png -i pipe:0 -c:v libx264 -pix_fmt yuv420p -map_metadata -1 -fflags +bitexact out.mp4`.

Rules: frames must be pure functions of `frame` (no `Math.random`/`Date.now`), `window.svelteMotion_*` globals drive the renderer, kill the server in `finally`.

Render gates: M0 determinism (`tools/spike/verify-determinism.ts` screenshots frame 0 and 90 twice, byte equality), M2 MP4 byte equality (same render twice produces identical bytes), M4 player parity (`tools/spike/verify-player-parity.ts` compares Player PNG to renderer PNG at same frame).

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

| Milestone | Title                | Gate                                                                                                         | Status      |
| --------- | -------------------- | ------------------------------------------------------------------------------------------------------------ | ----------- |
| M0        | Recon and the spike  | Same component screenshots identically at frame 0 and 90, determinism holds                                  | done        |
| M1        | Math and timeline    | `interpolate`/`spring`/`Sequence` match Remotion output, tests pass                                          | done        |
| M2        | Renderer CLI         | `svelte-motion render hello-world --out out.mp4` produces 3s MP4, frame count matches                        | done        |
| M3        | Assets and readiness | Font-heavy composition with `delayRender` renders without blank frames                                       | done        |
| M4        | Player               | `Player` plays at `fps` with scrubber, preview matches renderer PNG                                          | done        |
| M5        | Studio               | Composition picker, preview, scrubber, duration timeline bar (nested Sequence bars need a timeline registry) | mostly done |
| M6        | Polish, docs, skills | Docs, Valibot props, CLI help, tests pass (agent skills not written yet)                                     | mostly done |

See `plan/milestones.md` for commands and done-when checklists.

## Working agreements for agents

- Read `plan/README.md` first, then the specific doc for your task — don't guess from `README.md` alone.
- Keep `plan/` out of commits. Update `AGENTS.md` if the index drifts.
- Frame runtime is the single source of truth: `frame` as `$state`, derived values as `$derived`, never assign to `$state` inside `$effect` for frame math.
- Determinism gate blocks everything: no wall clock, no randomness in compositions.
- Prefer `Bun.spawn` and Valibot per stack decisions; document any deviation in `plan/decisions.md`.
- Svelte 5 constraint: named component prop types must live in `.ts` files (`timeline/types.ts`, `player/types.ts`). Components export only the default, `svelte-check` cannot see named exports from `.svelte` files.

## Where to look next

- Product code (when scaffolded): `src/lib/motion/context.svelte.ts`, `src/lib/timeline/Sequence.svelte`, `src/lib/renderer/render.ts`
- Full Remotion source (read-only reference): `plan/repomix/remotion.xml`
- Public overview: `README.md`
