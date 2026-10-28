# 0004. Browser core and Node renderer are separate packages

**Status:** Accepted, 2026-10-28.

## Context

The runtime that paints a composition runs in a browser. The renderer that captures it needs Playwright and FFmpeg, which are Node programs that must never reach a browser bundle.

A single package would force the `exports` map to lie about what is safe to import and would drag Node dependencies toward the browser. The same pressure appears as a feature request: a render button inside the Studio, which would require the browser to reach the Node renderer.

## Decision

Keep the boundary hard.

- `packages/core` is browser-only and contains no Node built-ins.
- `packages/renderer` is Node-only and consumes core.
- `packages/studio-ui` never imports `$app/*`; apps own their routes, URL state, and composition globs.
- The Studio does not trigger renders this round. Rendering stays CLI-only.
- Data crosses the boundary through URLs and host-set globals, not through shared Node objects.

## Consequences

**What got harder.** There is no in-browser render button. The CLI is the render path, and the Studio cannot offer one-click rendering without a server endpoint and a new trust boundary. Data that both sides need must be serialisable, and some small helpers may be duplicated rather than shared.

**What got better.** A browser bundle cannot pull Playwright or FFmpeg. Core can be deployed to static and adapter targets without dragging a server along. The renderer can be tested on its own.

**Why it is recorded.** The boundary is easy to erode one convenience feature at a time. Writing down the cost of reversing it stops the next "small" endpoint from being added without a decision.

See decisions D15 and D19 in `plan/decisions.md`.
