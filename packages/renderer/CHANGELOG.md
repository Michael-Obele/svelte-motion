# @svelte-motion/renderer

## 0.2.0

### Minor Changes

- 7755ada: feat: interactive CLI, timeline registry, streaming encode
  
  The CLI opens an interactive browser when run with no command: pick a
  composition with the arrow keys, press enter to render, and watch live progress
  with an ETA. Ctrl+C cancels a render. The bin is now `svelte-motion` rather than
  `cli`, so the documented command finally exists after a global install. `list`
  and `render` are unchanged and stay scriptable.
  
  Core gained a timeline registry: `Sequence` records its `id`, `from`, absolute
  offset and nesting depth, and `Player` exposes them through `getSequences()`, so
  tooling can draw a real timeline without reaching into a composition. `Sequence`
  also accepts an optional `id`.
  
  The renderer accepts an `AbortSignal`, so a render can be cancelled mid-flight,
  and streams frames to FFmpeg when `concurrency` is 1. Peak memory is now one
  frame instead of the whole video; higher concurrency still buffers to reorder.

## 0.1.2

### Patch Changes

- 4a5a05b: chore: add changesets for versioning

## 0.1.1

### Patch Changes

- chore(release): version packages
