<script lang="ts">
  import MotionRoot from "../../src/lib/motion/MotionRoot.svelte";
  import Video from "../../src/lib/timeline/Video.svelte";
  import Audio from "../../src/lib/timeline/Audio.svelte";

  let {
    kind,
    src,
    startFrom,
    muted,
    volume,
  }: {
    kind: "video" | "audio";
    src: string;
    startFrom?: number;
    muted?: boolean;
    volume?: number;
  } = $props();
</script>

<MotionRoot fps={30} width={1920} height={1080} durationInFrames={90} initialFrame={0}>
  {#if kind === "video"}
    <Video {src} startFrom={startFrom ?? 0} muted={muted ?? true} volume={volume ?? 1} />
  {:else}
    <Audio {src} startFrom={startFrom ?? 0} volume={volume ?? 1} />
  {/if}
</MotionRoot>
