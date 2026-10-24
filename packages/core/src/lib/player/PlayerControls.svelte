<script lang="ts">
  import type { PlayerControlsProps } from "./types.js";

  let { frame, durationInFrames, fps, isPlaying, onplay, onpause, onseek }: PlayerControlsProps =
    $props();

  const label = $derived(isPlaying ? "Pause" : "Play");
  const max = $derived(Math.max(0, durationInFrames - 1));
</script>

<div class="svelte-motion-player-controls">
  <button type="button" aria-label={label} onclick={isPlaying ? onpause : onplay}>
    {label}
  </button>

  <input
    type="range"
    min="0"
    max={max}
    step="1"
    value={frame}
    aria-label="Frame"
    oninput={(event) => onseek(Number((event.currentTarget as HTMLInputElement).value))}
  />

  <span class="readout">frame {frame} / {durationInFrames}</span>
  <span class="readout">{fps} fps</span>
</div>

<style>
  .svelte-motion-player-controls {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 12px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 12px;
  }

  .svelte-motion-player-controls button {
    padding: 4px 10px;
    border: 1px solid #ccc;
    border-radius: 4px;
    background: #fff;
    cursor: pointer;
    font: inherit;
  }

  .svelte-motion-player-controls input[type="range"] {
    flex: 1;
  }

  .readout {
    white-space: nowrap;
    color: #333;
  }
</style>
