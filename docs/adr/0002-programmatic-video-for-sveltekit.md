# 0002. Programmatic video for SvelteKit, not a Remotion clone

**Status:** Accepted, 2026-10-28.

## Context

The first plan described Svelte Motion as "Remotion-compatible" and treated matching Remotion's output as a goal. That framing has two problems.

It is legally unsafe. ADR 0001 explains why copying Remotion code cannot be relicensed as MIT.

It is strategically weak. A clone is judged by how closely it matches the original, and the original is tied to React and Webpack. SvelteKit offers things that tool structurally cannot: compositions as routes, remote functions for data, and a Studio that can deploy with the app through an adapter. Chasing parity gives those advantages away.

## Decision

Position the product as **programmatic video for SvelteKit**. Three differentiators, in priority order:

1. **SvelteKit integration** (the primary moat): compositions as routes, remote functions for data, adapter-deployable Studio. A React and Webpack tool cannot offer this without becoming a different product.
2. **Agent-first authoring**: skills, a CLI TUI, and schema-driven props, so an agent can scaffold a video from a prompt.
3. **Svelte-native ergonomics**: runes and snippets, no hook rules, a smaller mental model.

Remotion is prior art and a migration source, not the specification. Migration docs translate concepts; they do not promise compatibility.

## Consequences

**What got harder.** There is no "drop-in replacement" claim, so Remotion users need a translation guide. API decisions can no longer be justified with "Remotion does it". The SvelteKit integration work becomes the product rather than a nice-to-have.

**What got better.** The product has a reason to exist that is not "cheaper Remotion". The comparison is no longer a feature checklist against another project. SvelteKit-specific work is defensible on its own terms.

**What changed in the docs.** The plan README, `AGENTS.md`, the research notes, and the mapping table no longer use parity as a gate or compatibility as a promise.

See decision D23 in `plan/decisions.md`.
