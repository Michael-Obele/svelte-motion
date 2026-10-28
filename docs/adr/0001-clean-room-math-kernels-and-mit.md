# 0001. Clean-room re-implementation of the math kernels, and keeping MIT

**Status:** Accepted, 2026-10-28. The implementation is planned in milestone M1.5. At the time of writing the replacement is not complete; this ADR records the decision, not completion.

## Context

The project began by transcribing math helpers from Remotion's source. The plan justified that by saying the helpers were MIT, either from `svelte-in-motion` or from React Native's `Animated`. Passing through Remotion was treated as neutral.

It is not neutral. Remotion's `packages/core/LICENSE.md`, included in `plan/repomix/remotion.xml`, says:

> It is not allowed to copy or modify Remotion code for the purpose of selling, renting, licensing, relicensing, or sublicensing your own derivate of Remotion.

The product is distributed under MIT. That means relicensing the derivative, which the sentence above withholds permission for. Removing the provenance comments does not change the provenance; a comment is not a licence.

## Decision

Keep the product MIT, and replace the transcribed kernels with clean-room implementations.

- The kernels are `interpolate`, `interpolateColors`, `spring`, `measureSpring`, `bezier`, and `easing`.
- Each is re-implemented from behaviour and specification, not transcribed. Where a mathematical definition exists, the code is derived from the maths: cubic-bezier solving, the damped harmonic oscillator, and linear range mapping.
- Permissively licensed prior art is allowed, notably React Native's MIT `Animated`. Where code is genuinely derived from an MIT source, its upstream notice is retained.
- Bit-for-bit parity with Remotion is no longer a gate. Behaviour is pinned by a curated fixture table generated independently of the old implementation, plus property tests and a documented divergence wherever the maths dictates a different result.
- Residual transcribed code is deleted before any release. Removing the comments is not enough.

## Consequences

**What got harder.** Each kernel needs a written contract, an independent fixture table, and property tests. Re-deriving takes longer than copying. Values can drift from what Remotion produces, and each divergence has to be documented rather than hidden behind a parity gate.

**What got better.** The MIT claim is defensible. There is no longer a sync burden with Remotion releases, and the public API stops inheriting another project's edge cases by accident.

**What blocks.** Milestone M1.5 blocks any release, and its gate includes a provenance audit.

**What did not change.** Function names, argument shapes, and determinism. The API stays familiar; the implementation becomes original.

See decisions D22, D10, and D14 in `plan/decisions.md`. The milestone is M1.5 in `plan/milestones.md`.
