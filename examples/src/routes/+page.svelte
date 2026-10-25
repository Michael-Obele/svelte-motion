<script module lang="ts">
    /**
     * The examples gallery.
     *
     * Every card is one composition registered by this app. This is the app a user
     * writes: it has its own `src/lib/compositions`, it globs them itself, and it
     * installs `@svelte-motion/core` from the package rather than aliasing another
     * folder's source.
     *
     * The app owns the glob because `import.meta.glob` resolves relative to the
     * module that contains it.
     */
    import { collectCompositions } from "@svelte-motion/core";

    const compositions = collectCompositions(
        import.meta.glob("/src/lib/compositions/*/index.ts", {
            eager: true,
        }) as Record<string, { default?: unknown }>,
    );
</script>

<script lang="ts">
    import { formatDuration } from "@svelte-motion/studio-ui";

    const rowCount = compositions.length;
</script>

<svelte:head>
    <title>svelte-motion examples</title>
</svelte:head>

<div class="h-screen overflow-y-auto bg-studio text-ink">
    <header class="mx-auto max-w-6xl px-8 pt-14 pb-8">
        <h1 class="text-2xl font-semibold tracking-tight">
            svelte-motion examples
        </h1>
        <p class="mt-2 max-w-2xl text-sm text-muted">
            {rowCount} compositions, each built with the published
            <code class="text-ink">@svelte-motion/core</code> package. Open one to
            preview it in the Studio, scrub it, or copy the CLI command that renders
            it to an MP4.
        </p>
    </header>

    <ul
        class="mx-auto grid max-w-6xl gap-4 px-8 pb-16 sm:grid-cols-2 lg:grid-cols-3"
    >
        {#each compositions as composition (composition.id)}
            <li>
                <a
                    href="/{composition.id}"
                    class="block h-full rounded border border-line bg-panel p-5 transition-colors hover:border-accent"
                >
                    <span class="block text-sm font-medium"
                        >{composition.id}</span
                    >
                    <span class="mt-1 block text-xs text-muted">
                        {composition.width}×{composition.height} · {composition.fps}
                        fps ·
                        {formatDuration(
                            composition.durationInFrames,
                            composition.fps,
                        )}
                    </span>
                    <span class="mt-3 block text-xs text-accent"
                        >Open in Studio →</span
                    >
                </a>
            </li>
        {/each}
    </ul>
</div>
