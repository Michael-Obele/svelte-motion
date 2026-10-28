---
"@svelte-motion/renderer": minor
"@svelte-motion/cli": minor
---

Add GIF and WebM output. The destination's extension now picks the encoder — `.mp4`/`.mov`/`.mkv` stay on H.264, `.webm` writes VP9, and `.gif` writes an animated GIF through a two-stage palette filter (128 colours, 15fps and 1280px wide by default). An extension that names no known format fails before the browser launches instead of after every frame is captured.

GIF is 4000x smaller than the encoder's unfiltered output on flat art: 2.8 KB versus 11 MB for a 2 s 1280x400 clip. `RenderResult` gained `format` and `outputFps`, because a GIF plays at a capped rate and reporting the source rate would be a lie.

Also adds the `banner` example, the artwork from `assets/banner.svg` rebuilt as a composition, and `bun run banner` to regenerate `assets/banner.gif` and `assets/banner.mp4`.
