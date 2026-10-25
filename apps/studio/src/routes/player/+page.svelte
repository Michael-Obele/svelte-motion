<script module lang="ts">
    /**
     * The player host route.
     *
     * `/player?composition=<id>&frame=<n>&props=<url-encoded JSON>` draws one paused
     * frame of one composition through `<Player>`, with the stage at (0,0) and
     * controls below the clip region, so a headless browser can screenshot the stage
     * and compare it byte-identically to the `/render` host at the same frame. The
     * M4 gate drives this URL.
     *
     * The app owns the glob and the URL. The pixels come from `<PlayerHost>` in
     * `@svelte-motion/studio-ui`, which the examples app mounts from an identical
     * route.
     */
    import {
        collectCompositions,
        setSvelteMotionEnvironmentFlag,
    } from "@svelte-motion/core";

    const compositions = collectCompositions(
        import.meta.glob("/src/compositions/*/index.ts", {
            eager: true,
        }) as Record<string, { default?: unknown }>,
    );

    // Set before anything mounts — the same handshake the renderer performs. It has
    // to happen at module scope: unknown ids never mount a Player, and the flag
    // still describes the shell they are drawn in.
    setSvelteMotionEnvironmentFlag("svelteMotion_isPlayer", true);

    /** Ids in registration order, for the unknown-composition page. */
    const compositionIds = compositions.map((composition) => composition.id);
</script>

<script lang="ts">
    import { onMount } from "svelte";
    import { page } from "$app/state";
    import {
        getComposition,
        getCompositions,
        installReadinessGlobal,
    } from "@svelte-motion/core";
    import { PlayerHost, resolveHostProps } from "@svelte-motion/studio-ui";

    const params = $derived(page.url.searchParams);
    const compositionId = $derived(params.get("composition") ?? "");
    const composition = $derived(getComposition(compositionId));
    const host = $derived(resolveHostProps(composition, params));

    // Expose validation error for the renderer to read before the ready wait.
    $effect(() => {
        const bridge = window as unknown as Record<string, unknown>;
        if (host.validationError !== undefined) {
            bridge.svelteMotion_validationError = host.validationError;
        } else {
            bridge.svelteMotion_validationError = undefined;
        }
    });

    // Player-facing globals. `svelteMotion_getCompositions` lets a driver list what
    // it can render; `svelteMotion_inputProps` echoes the props actually in use, so a
    // render can be reproduced from its own page. `installReadinessGlobal` lets a
    // driver poll `window.svelteMotion_ready()`.
    onMount(() => {
        installReadinessGlobal();
        const bridge = window as unknown as Record<string, unknown>;
        bridge.svelteMotion_getCompositions = () => getCompositions();
        bridge.svelteMotion_inputProps = host.inputProps;

        return () => {
            delete bridge.svelteMotion_getCompositions;
            delete bridge.svelteMotion_inputProps;
            delete bridge.svelteMotion_validationError;
            delete bridge.svelteMotion_ready;
            delete bridge.svelteMotion_pendingHandles;
        };
    });
</script>

<PlayerHost
    {composition}
    {compositionId}
    frame={host.frame}
    inputProps={host.inputProps}
    validationError={host.validationError}
    availableIds={compositionIds}
/>
