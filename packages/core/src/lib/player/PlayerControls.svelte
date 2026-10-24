<script lang="ts">
    import type { PlayerControlsProps } from "./types.js";

    let {
        frame,
        durationInFrames,
        fps,
        isPlaying,
        onplay,
        onpause,
        onseek,
    }: PlayerControlsProps = $props();

    const label = $derived(isPlaying ? "Pause" : "Play");
    const max = $derived(Math.max(0, durationInFrames - 1));
</script>

<div class="svelte-motion-player-controls">
    <button
        type="button"
        aria-label={label}
        onclick={isPlaying ? onpause : onplay}
    >
        {label}
    </button>

    <input
        type="range"
        min="0"
        {max}
        step="1"
        value={frame}
        aria-label="Frame"
        oninput={(event) =>
            onseek(Number((event.currentTarget as HTMLInputElement).value))}
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
        font-family:
            system-ui,
            -apple-system,
            sans-serif;
        font-size: 12px;
    }

    /*
   * Colours come from `currentColor`, not hard-coded values. Core is
   * framework- and theme-agnostic: this control sits inside a light page and a
   * dark studio, and a fixed white background made the label unreadable on the
   * dark one. Inheriting means the host decides, and the contrast follows.
   */
    .svelte-motion-player-controls button {
        padding: 4px 10px;
        border: 1px solid currentColor;
        border-radius: 4px;
        background: transparent;
        color: inherit;
        cursor: pointer;
        font: inherit;
        opacity: 0.85;
    }

    .svelte-motion-player-controls button:hover {
        opacity: 1;
        background: rgb(127 127 127 / 0.18);
    }

    .svelte-motion-player-controls input[type="range"] {
        flex: 1;
        accent-color: currentColor;
    }

    .readout {
        white-space: nowrap;
        color: inherit;
        opacity: 0.7;
    }
</style>
