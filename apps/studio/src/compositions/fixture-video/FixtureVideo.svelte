<script lang="ts">
  /**
   * Video seek fixture.
   *
   * `render.e2e.test.ts` generates a tiny VP9 WebM into the build directory and
   * drives this composition across frames. The video is the only thing that
   * changes between frames, so a differing screenshot is proof that the
   * `<Video>` seek path ran, and a completed capture is proof that the `seeked`
   * handle was released rather than timing out.
   *
   * The source is a prop instead of a committed asset because the test owns the
   * fixture: ffmpeg writes it on demand, and nothing binary enters the repo.
   */
  import { AbsoluteFill, Video } from "@svelte-motion/core";

  let {
    src = "fixture-video-seek.webm",
    startFrom = 0,
  }: { src?: string; startFrom?: number } = $props();
</script>

<AbsoluteFill style="background: #000;">
  <Video {src} {startFrom} style="width: 100%; height: 100%; object-fit: cover;" />
</AbsoluteFill>
