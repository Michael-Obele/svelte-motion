<script module lang="ts">
    /**
     * One composition, in the Studio.
     *
     * The Studio is `@svelte-motion/studio-ui` — the same component `apps/studio`
     * mounts. Nothing here reaches into the studio app's folder, which is the whole
     * point: a user's app uses the studio, not the other way round.
     */
    import { collectCompositions } from "@svelte-motion/core";

    const compositions = collectCompositions(
        import.meta.glob("/src/lib/compositions/*/index.ts", {
            eager: true,
        }) as Record<string, { default?: unknown }>,
    );
</script>

<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import { Studio } from "@svelte-motion/studio-ui";

    /** `/<id>` — unknown ids fall back to the first composition inside the Studio. */
    const requestedId = $derived(page.params.id);

    /** Keep the URL in step so a preview can be linked and reloaded. */
    const select = (id: string): void => {
        goto(`/${id}`, { replace: true, reset: false });
    };
</script>

<Studio {compositions} initialId={requestedId} onselect={select} />
