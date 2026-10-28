<script module lang="ts">
    /**
     * The studio app's index: its own fixture compositions, in the shared Studio.
     *
     * This app no longer knows where the examples folder is. It lists the
     * compositions it owns, and the examples app lists its own — both render them
     * through the same `<Studio>` from `@svelte-motion/studio-ui`. That is the
     * direction that matters for a user: their app uses the studio, not the other
     * way round.
     *
     * The app owns the glob. `import.meta.glob` resolves relative to the module
     * that contains it, so a glob inside the library would only ever see the
     * library's own files.
     */
    import { collectCompositions } from "@svelte-motion/core";

    const compositions = collectCompositions(
        import.meta.glob("/src/compositions/*/index.ts", {
            eager: true,
        }) as Record<string, { default?: unknown }>,
    );
</script>

<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import { Studio } from "@svelte-motion/studio-ui";

    // Reactive on purpose: SvelteKit reuses this page when only the query string
    // changes, and a once-read value would keep pointing at the old selection.
    const requestedId = $derived(
        page.url.searchParams.get("composition") ?? undefined,
    );

    /**
     * Selection is this app's business, not the Studio's: it owns `?composition=` so
     * a preview can be linked and reloaded. The examples gallery, which has no such
     * URL state, simply does not pass this callback.
     */
    const select = (id: string): void => {
        goto(`?composition=${encodeURIComponent(id)}`, {
            // SvelteKit 3 collapsed `replaceState` + `keepFocus` + `noScroll` into
            // `replace` and `reset`. `reset: false` keeps scroll position and focus,
            // which is what a picker click needs: the list must not jump to the top.
            replace: true,
            reset: false,
        });
    };
</script>

<Studio {compositions} initialId={requestedId} onselect={select} />
