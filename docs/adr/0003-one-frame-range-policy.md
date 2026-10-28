# 0003. One frame-range policy

**Status:** Accepted, 2026-10-28. Implemented.

## Context

Several surfaces accept a frame from outside the composition: the host query parser, the Player, the motion root's `initialFrame`, and the Studio scrubber. Each could decide the last valid frame for itself.

`durationInFrames = N` was ambiguous at the boundary. Is frame N the last frame, or is N the count? An off-by-one here makes the Player and the renderer disagree, and makes the end of a video either unreachable or played twice.

## Decision

Use one policy everywhere:

- `durationInFrames = N` means N frames, indexed `0..N-1`.
- The last valid frame is `N-1`.
- One boundary function in core is the only place that clamps a frame. The host query parser, the Player, the motion root's `initialFrame`, and the Studio scrubber all go through it.
- Non-finite input becomes frame 0.
- Looping wraps; non-looping clamps to `N-1`.

## Consequences

**What got harder.** Every new entry point that accepts a frame must route through the one function. Code that expected frame `N` to be valid has to change. Loop and clamp remain different behaviours, so the caller still chooses one deliberately.

**What got better.** The Player, renderer, Studio, and host agree on the last frame. Boundary tests can pin 0, `N-1`, and `N` without guessing which surface they are testing.

**What did not change.** `durationInFrames` still means a count of frames, not a maximum index.

See decision D24 in `plan/decisions.md`.
