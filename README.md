# svelte-remotion

> Make videos programmatically with Svelte 5 + SvelteKit. Remotion for Svelte, headless Chrome + FFmpeg, MIT licensed.

Write a video as a Svelte component. The renderer screenshots every frame in headless Chromium and FFmpeg stitches them to MP4. Same pipeline as Remotion, no React.

```html
<script lang="ts">
  import { getMotionContext } from "$lib/motion/context.svelte";
  import { interpolate } from "$lib/math/interpolate";

  const motion = getMotionContext();
  let opacity = $derived(interpolate(motion.frame, [0, 30], [0, 1]));
</script>

<div style:opacity>{motion.frame}</div>
```

```bash
svelte-remotion render hello-world --out out.mp4
```

## Status

Planning. See `plan/` (gitignored, canonical copy at `AI-Plans/plans/svelte-motion/`) for the full spec.

| Doc                         | What it answers                                         |
| --------------------------- | ------------------------------------------------------- |
| `plan/README.md`            | Human door — summary, deliverables, next steps          |
| `plan/research.md`          | Verified facts + sources, React vs Svelte answer        |
| `plan/architecture.md`      | Components, module layout, frame runtime, failure modes |
| `plan/svelte-mapping.md`    | Exact React → Svelte 5 API translation                  |
| `plan/rendering.md`         | Headless Chrome + FFmpeg pipeline, determinism, CLI     |
| `plan/decisions.md`         | 14 decisions, 10 risks, open questions                  |
| `plan/milestones.md`        | M0–M6 with commands and done-when gates                 |
| `plan/repomix/remotion.xml` | Full Remotion source, 12,733 files, 9.8M tokens, XML    |

## Quick start (when ready)

```bash
bunx sv create svelte-remotion --template minimal
bun install
bunx playwright install chromium
bun run build
bun src/cli.ts render hello-world --out out.mp4
```

## License

MIT
