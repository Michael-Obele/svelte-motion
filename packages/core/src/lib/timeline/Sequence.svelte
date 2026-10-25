<script module lang="ts">
  /** Auto ids for Sequences without an explicit `id`. Module state, not reactive. */
  let autoIdCounter = 0;
</script>

<script lang="ts">
  /**
   * Offsets time for its children.
   *
   * Children see a local frame through both channels: the `frame` snippet
   * argument and `useCurrentFrame()` inside the nearest context. The snippet
   * argument is the explicit one; the context override means nested components
   * do not need the frame threaded through them.
   *
   * Each instance also registers with the timeline registry (id, from,
   * duration, depth) so the Studio can draw bars without knowing composition
   * internals. Registration is mount bookkeeping via `$effect` cleanup, not
   * frame math.
   */
  import { getContext, setContext, untrack } from "svelte";
  import {
    DerivedMotionContext,
    getMotionContext,
    setMotionContext,
    type SequenceEntry,
  } from "../motion/context.svelte.js";
  import {
    TIMELINE_KEY,
    type SequenceProps,
    type TimelinePosition,
  } from "./types.js";

  let { id, from = 0, durationInFrames, children }: SequenceProps = $props();

  const parent = getMotionContext();

  // Nesting position. Ancestors never change under a mounted instance, so this
  // context read is init-only. Depth 0 is top-level.
  const parentPos: TimelinePosition = getContext<TimelinePosition | undefined>(
    TIMELINE_KEY,
  ) ?? { depth: -1, absoluteFrom: 0 };
  const depth = parentPos.depth + 1;
  // A Sequence's offset is fixed at mount: ancestors never change under a mounted
  // instance. `untrack` says so out loud and silences state_referenced_locally.
  const offset = untrack(() => from);
  setContext<TimelinePosition>(TIMELINE_KEY, {
    depth,
    absoluteFrom: parentPos.absoluteFrom + offset,
  });

  const autoId = `sequence-${++autoIdCounter}`;
  const seqId = $derived(id ?? autoId);
  const absoluteFrom = $derived(parentPos.absoluteFrom + offset);

  setMotionContext(new DerivedMotionContext(parent, (p) => p.frame - offset));

  const localFrame = $derived(parent.frame - offset);
  const visible = $derived(
    localFrame >= 0 &&
      (durationInFrames === undefined || localFrame < durationInFrames),
  );

  /*
   * Timeline registry. Re-registers when identifying props change and
   * unregisters on destroy. Registry calls are untracked: the effect must
   * depend on the identifying props only, never on the registry array it
   * mutates (a read-write loop otherwise: effect_update_depth_exceeded).
   * Note: children of a hidden Sequence never mount, so a nested entry
   * appears only while its ancestors are visible at the current frame.
   */
  $effect(() => {
    const host = parent as unknown as {
      registerSequence?: (entry: SequenceEntry) => void;
      unregisterSequence?: (entryId: string) => void;
    };
    const entry: SequenceEntry = {
      id: seqId,
      from: offset,
      absoluteFrom,
      durationInFrames,
      depth,
    };
    untrack(() => host.registerSequence?.(entry));
    const registeredId = entry.id;
    return () => {
      untrack(() => host.unregisterSequence?.(registeredId));
    };
  });
</script>

{#if visible}
  {@render children({ frame: localFrame })}
{/if}
