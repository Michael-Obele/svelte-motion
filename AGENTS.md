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
| `plan/svelte-mapping.md`    | React → Svelte 5 API translation                        | You need the Remotion concept → Svelte table        |
| `plan/rendering.md`         | Headless Chrome + FFmpeg pipeline, determinism, CLI     | You need the render pipeline or concurrency rules   |
| `plan/decisions.md`         | D1–D28, risks, open questions                           | You need why a choice was made or what was rejected |
| `plan/milestones.md`        | M0–M9 plus M1.5 with commands and done-when gates       | You need the next task and its gate                 |
| `GLOSSARY.md`               | Terms used across the project                           | You need a precise definition, not a spec           |
| `docs/adr/`                 | Load-bearing decisions and what they cost               | You need the reasoning behind a boundary            |
| `plan/repomix/remotion.xml` | Remotion source, 12,733 files, 9.8M tokens, XML         | You need prior-art behaviour (do not copy; D22)     |

## Architecture at a glance

```
Author writes Svelte composition (frame -> pixels)
  -> Vite+ 1.4 (via @voidzero-dev/vite-plus-core 1.4.0) + SvelteKit 3.1 + Bun 1.4.4 bundles to browser JS
  -> dev: SvelteKit dev server + Studio (scrubber, timeline)
  -> render: Playwright launches headless Chromium
           -> for frame 0..durationInFrames-1: set frame, wait ready, screenshot PNG
           -> FFmpeg via Bun.spawn stitches PNGs to MP4
```

Module layout — a Vite+ workspace with Bun workspaces, scaffolded by the `vp` CLI:

```
packages/core/       # @svelte-motion/core      browser-only: motion/, timeline/, math/, player/
                     #                          built with svelte-package (tsdown cannot compile .svelte)
packages/studio-ui/  # @svelte-motion/studio-ui component library: <Studio>, <RenderHost>,
                     #                          <PlayerHost>. No `$app/*`, so any app can mount it
packages/renderer/   # @svelte-motion/renderer  node-only: browser.ts, ffmpeg.ts, render.ts, assets.ts
packages/cli/        # @svelte-motion/cli       bin; standalone executable later via pack.exe
apps/studio/         # SvelteKit authoring host: its own fixtures + /render + /player for the gates
apps/web/            # homepage + docs (SvelteKit + shadcn-svelte)
examples/            # SvelteKit app the way a user writes one: 8 compositions + gallery + hosts
```

The split is a hard boundary, not tidiness: the renderer shells out to Playwright and FFmpeg, so
it must never be reachable from a browser bundle. `core` stays free of Node built-ins; anything
that needs the filesystem belongs in `renderer`.

The dependency arrow is one-way: **apps use the studio, never the reverse.** `examples` and
`apps/studio` both mount `<Studio>` from `packages/studio-ui`, and each app owns its own
composition glob, URL state and `/render` + `/player` routes. That is why `studio-ui` must never
import `$app/state` or `$app/navigation` — routes cannot live in a package, so anything
route-shaped stays in the app that owns it.

The two apps resolve `@svelte-motion/core` differently **on purpose**:

- `apps/studio` aliases it to `src/lib/index.ts`, so authoring never hits a stale `dist`.
- `examples` takes it from `workspace:*` → `dist`, so it exercises the _published_ entry points
  the way a real install does. A broken `exports` map or a missing `.d.ts` re-export fails here
  and nowhere else. It therefore needs `vp run core#build` first (`bun run build:examples`
  handles that ordering for you).

Workspace commands (`vp` is Vite+, `vpr` is `vp run`):

```bash
bun run dev            # the examples app: gallery + Studio, all 8 compositions
bun run dev:studio     # the fixture harness (hello-world + fixture-*), for gate work
vp run -r build        # recursive, cache-aware build of every member (dependency order)
vp run studio#dev      # one member by package name
vp -C apps/studio dev  # one member by directory
vp check               # fmt + lint + typecheck across the workspace
vp run -r test         # every member's tests (cached)
vp run studio#build    # build the studio (fixtures + hosts used by the gates)

# The examples app installs core from dist, so build core first
bun run build:examples # = vp run -t examples#build (core, then examples)
bun run dev:examples   # = vp run core#build && vp run examples#dev
bun run check:examples # svelte-check over the examples app

SM_E2E=1 vp test       # per-package e2e, run inside the package dir (vp run cache ignores env vars)
bun run tools/spike/verify-determinism.ts  # M0 determinism gate
bun run tools/spike/verify-player-parity.ts  # M4 player parity gate
```

`vp check` and `vp fmt` read lint/format settings **only** from the root `vite.config.ts`;
per-package `lint`/`fmt` blocks are ignored, so package-specific rules belong in `overrides`.

See `plan/architecture.md` for the full component table, interfaces, and failure modes.

## Decisions (settled)

- **D1** Start clean from `bunx sv create`; don't fork `svelte-in-motion`. The "copy math helpers" half is superseded by D22.
- **D2** Svelte 5 runes only (`$state`, `$derived`, `$effect`, `$props`, snippets).
- **D3** SvelteKit 3.1 + Vite+ 1.4 + Bun 1.4.4 (routing, adapters, `adapter-static` for render). Confirmed at scaffold, not Vite 6 or SvelteKit 2.
- **D4** Vite for bundling, not Webpack.
- **D5** `delayRender`/`continueRender` + `ready` boolean (same counter, two APIs).
- **D6** Playwright over Puppeteer (multi-browser, stable screenshot API).
- **D7** `Bun.spawn` for FFmpeg (stdin streaming).
- **D8** Valibot for props validation (Zod accepted as alternative).
- **D15** Vite+ (`vp`) monorepo on Bun workspaces, seven members, `@svelte-motion/*` scope — supersedes D11. See `plan/decisions.md` for the scaffold-time version findings.
- **D16** `packages/studio-ui` is a private component library consumed from source; the studio chrome
  takes compositions as a prop and reports selection through a callback. Apps own routes, URL state
  and globs. See `plan/decisions.md`.
- **D17** `examples/` is a scaffolded SvelteKit app (`sv create --template minimal`), not a folder of
  loose components. It consumes `@svelte-motion/core` from `dist` on purpose.
- **D18** OpenTUI (`@opentui/core`) for the CLI TUI: full interactive mode, one-shot commands kept,
  bin renamed `cli` → `svelte-motion`. Spiked and verified under Bun 1.4.4. See `plan/decisions.md`.
- **D19** Studio stays CLI-only for rendering this round; the browser/Node boundary stays unpierced.
- **D20** Audio deferred; streaming encode ships in M9. `interpolate` `output`/`outputType` CSS sugar is deliberately unimplemented and needs a decision (implement from spec or remove the throw).
- **D21** Subagent model: DeepSeek V4.1 Flash primary, Muse Spark 1.3 Contributor fallback
  (Michael's call 2026-10-25, overrides ZenPick's Muse advantage).
- **D22** Math kernels are being replaced with clean-room re-implementations, not copies; the product
  stays MIT and Remotion parity is not a gate. M1.5 blocks release. See `docs/adr/0001-clean-room-math-kernels-and-mit.md`.
- **D23** Position as programmatic video for SvelteKit, not a Remotion clone: SvelteKit integration,
  agent-first authoring, Svelte-native ergonomics, in that order. See `docs/adr/0002-programmatic-video-for-sveltekit.md`.
- **D24** One frame range: `[0, durationInFrames - 1]`; one `clampFrame` serves every entry point.
  See `docs/adr/0003-one-frame-range-policy.md`.
- **D25** Hosts key playback sessions on composition identity plus init-only config, never on frame;
  the shell owns the `window.svelteMotion_*` environment flags.
- **D26** Props: absent means defaults; present but invalid reports and renders defaults; valid passes
  Valibot's validated output, never the raw parsed object.
- **D27** Media readiness handlers run first, then forward to the user's callback; props use Svelte's
  native element attribute types.
- **D28** Svelte's built-in motion is an interaction primitive, not a render primitive: the frame owns
  time. `svelte/easing` is re-exported as `svelteEasing`; `use:frameTransition` drives Svelte's own
  transition factories from the frame instead of the Web Animations clock; a seek that leaves an
  animation running warns once per identity. See
  `docs/adr/0005-svelte-built-in-motion-is-an-interaction-primitive.md`.

Open questions live in `plan/decisions.md`: system FFmpeg vs shipped binaries, Zod acceptance, and the
`interpolate` output sugar. SvelteKit version is settled: **3.1.0** (D15), not the D9 dual-path. Studio
scope is settled (D18, M8).

## Rendering pipeline (determinism is the gate)

1. **Bundle** — `vp run studio#build` via Vite + `vite-plugin-svelte` + `adapter-static` to `apps/studio/build/`
   (or `vp run examples#build` to `examples/build/`; both apps serve the same `/render` and
   `/player` hosts from `packages/studio-ui`).
2. **Serve** — `Bun.serve` on `127.0.0.1` with SPA fallback to `index.html` (no HMR, no `vite preview`).
3. **Capture** — Playwright `page.goto('.../render?composition=id&frame=N')` → wait `svelteMotion_ready()` + `document.fonts.ready` → `page.screenshot({ clip })`.
4. **Encode** — `Bun.spawn` FFmpeg image2pipe: `ffmpeg -framerate 30 -f image2pipe -vcodec png -i pipe:0 -c:v libx264 -pix_fmt yuv420p -map_metadata -1 -fflags +bitexact out.mp4`.

Rules: frames must be pure functions of `frame` (no `Math.random`/`Date.now`), the valid range is
`0..durationInFrames-1` and every entry point clamps through `clampFrame` (D24), `window.svelteMotion_*`
globals drive the renderer, kill the server in `finally`.

Render gates: M0 determinism (`tools/spike/verify-determinism.ts` screenshots frame 0 and 90 twice, byte equality), M2 MP4 byte equality (same render twice produces identical bytes), M4 player parity (`tools/spike/verify-player-parity.ts` compares Player PNG to renderer PNG at same frame).

See `plan/rendering.md` for concurrency, asset prefetch, and `delayRender` timeout handling.

## Svelte 5 mapping (React → Svelte)

| Remotion                   | Svelte Motion                                | Notes                                                 |
| -------------------------- | -------------------------------------------- | ----------------------------------------------------- |
| `useCurrentFrame()`        | `getMotionContext().frame` (`$state`)        | Same name, rune-backed                                |
| `useVideoConfig()`         | `useVideoConfig()`                           | `{fps, width, height, durationInFrames}`              |
| `<Sequence from duration>` | `<Sequence from durationInFrames>` + snippet | `localFrame = globalFrame - sum(from ancestors)`      |
| `<Series>`                 | `<Series>`                                   | Computes `from` cumulatively                          |
| `<Loop>` / `<Freeze>`      | `<Loop>` / `<Freeze>`                        | `frame % duration` / pinned frame                     |
| `Composition`              | `defineComposition` + `import.meta.glob`     | Registry via Vite glob                                |
| `interpolate`/`spring`     | `interpolate`/`spring`                       | Pure TS; clean-room re-implementation planned         |
| `<Transition>`             | `use:frameTransition`                        | Svelte's own transition factories, frame-driven (D28) |
| `delayRender`              | `delayRender` + `ready`                      | Counter-based, renderer polls                         |

See `plan/svelte-mapping.md` for the full table and snippet examples.

## Milestones (M0–M9 plus M1.5)

| Milestone | Title                | Gate                                                                                                          | Status      |
| --------- | -------------------- | ------------------------------------------------------------------------------------------------------------- | ----------- |
| M0        | Recon and the spike  | Same component screenshots identically at frame 0 and 90, determinism holds                                   | done        |
| M1        | Math and timeline    | Determinism plus curated behavioural fixtures; divergence from prior art documented (no Remotion parity gate) | done        |
| M1.5      | Clean-room kernels   | Kernel contracts plus independent fixtures; transcribed code deleted; provenance audit clean (see D22)        | pending     |
| M2        | Renderer CLI         | `svelte-motion render hello-world --out out.mp4` produces 3s MP4, frame count matches                         | done        |
| M3        | Assets and readiness | Font-heavy composition with `delayRender` renders without blank frames                                        | done        |
| M4        | Player               | `Player` plays at `fps` with scrubber, preview matches renderer PNG                                           | done        |
| M5        | Studio               | Composition picker, preview, scrubber, duration timeline bar; nested bars land in M8                          | done        |
| M6        | Polish, docs, skills | Docs, Valibot props, CLI help, tests pass; agent skills land in M9                                            | mostly done |
| M7        | CLI TUI              | Interactive OpenTUI mode renders with live progress at any width; one-shot commands unchanged (see D18)       | done        |
| M8        | Studio proper        | Timeline registry drives nested Sequence bars, props editor, shortcuts, lucide icons (see D19)                | done        |
| M9        | Debts and cleanup    | `interpolate` output sugar decided, streaming encode, agent skills, docs swept (see D20)                      | mostly done |

See `plan/milestones.md` for commands and done-when checklists.

## Working agreements for agents

- Read `plan/README.md` first, then the specific doc for your task — don't guess from `README.md` alone.
- Keep `plan/` out of commits. Update `AGENTS.md` if the index drifts.
- Frame runtime is the single source of truth: `frame` as `$state`, derived values as `$derived`, never assign to `$state` inside `$effect` for frame math.
- Determinism gate blocks everything: no wall clock, no randomness in compositions.
- Do not copy Remotion code. The math kernels are being replaced with clean-room implementations (D22);
  M1.5 blocks release until the transcribed ones are deleted and the provenance audit is clean. See
  `docs/adr/0001-clean-room-math-kernels-and-mit.md`.
- Prefer `Bun.spawn` and Valibot per stack decisions; document any deviation in `plan/decisions.md`.
- Svelte 5 constraint: named component prop types must live in `.ts` files (`timeline/types.ts`, `player/types.ts`). Components export only the default, `svelte-check` cannot see named exports from `.svelte` files.

## Testing workflows without pushing

Do not test a workflow by pushing it and watching the run. Most workflow bugs are static —
schema, expression grammar, permissions, injection — and never need a runner. Work down this
list and stop at the first layer that answers the question:

| Layer     | Command                                                                               | Catches                                                                                                                   | Cost         |
| --------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------ |
| Static    | `uvx --from actionlint-py actionlint -shellcheck= -pyflakes= .github/workflows/*.yml` | Schema and expression errors — the "This run likely failed because of a workflow file issue" class, where zero jobs start | ~1s          |
| Security  | `uvx zizmor --offline .`                                                              | Injection, unpinned actions, over-broad permissions, credential persistence                                               | ~13s cold    |
| Execution | `act push -W .github/workflows/<file>.yml -j <job>`                                   | "Does the job actually run"                                                                                               | ~10s warm    |
| Logic     | `bun test tools/release/`                                                             | The actual decision a step makes                                                                                          | milliseconds |

`actionlint` is already a CI gate (`.github/workflows/actionlint.yml`); run it locally before
pushing a workflow change. It is a Go binary, so `uvx actionlint` fails with "No solution found
when resolving tool dependencies" — use `uvx --from actionlint-py actionlint` or the pinned
binary. `zizmor` is not gated yet — run it when you touch a workflow. It currently reports
`unpinned-uses` across `actionlint.yml`, `publish.yml`, `release.yml` and `ci.yml` because actions
are pinned to tags (`@v7`, `@v2`) rather than commit SHAs; that is a deliberate repo-wide style
choice, not a regression, so do not "fix" it in one file only.

`act` is installed and its runner image is cached. `.actrc` sets `--pull=false`, because the
default re-checks the 2.3 GB image on every run; pull it by hand when you want a newer one.
Useful flags: `act -l` lists every job, `--dryrun` prints the graph without running, and
`-s GITHUB_TOKEN="$(gh auth token)"` is needed for any step that clones an action.

`act` has limits worth knowing before you trust it: it runs against the real repository (a
workflow that pushes a branch will push it), it cannot mock the GitHub API, and its default
images are incomplete. `changesets/action` in particular fails at the end with
`Reference does not exist` because it calls the real API — that failure is expected locally.

The most efficient test is the one that needs no workflow at all: put the decision in a script
under `tools/` and unit-test it. `tools/release/version-from-commits.ts` is the model — the
release workflow is thin glue around a function with `bun test` coverage, so a policy change is
provable in milliseconds instead of a push-and-wait cycle.

## Where to look next

- Frame runtime: `packages/core/src/lib/motion/context.svelte.ts`
- Svelte-motion integration: `packages/core/src/lib/motion/frame-transition.svelte.ts`, `wall-clock.ts`, `math/svelte-easing.ts`
- Timeline primitives: `packages/core/src/lib/timeline/`
- Studio surfaces: `packages/studio-ui/src/lib/` (`Studio`, `RenderHost`, `PlayerHost`, `host-params`)
- A user-facing composition: `examples/src/lib/compositions/title-card/`
- Render pipeline: `packages/renderer/src/render.ts`
- Terms: `GLOSSARY.md`
- Load-bearing decisions: `docs/adr/`
- Remotion source (prior-art reference only; do not copy): `plan/repomix/remotion.xml`
- Public overview: `README.md`
