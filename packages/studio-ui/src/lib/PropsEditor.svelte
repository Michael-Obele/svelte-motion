<script lang="ts">
    /**
     * Schema-driven props form.
     *
     * Controlled: the parent owns `value` and receives every edit through
     * `onChange`, so the preview updates live. String/number/boolean fields
     * render inputs; anything else shows a note. Validation errors display but
     * never block the preview. Renders nothing when the schema is not an object
     * with entries.
     */
    import { safeParse } from "valibot";
    import type { PropsEditorProps } from "./studio-types.js";

    let { composition, value, onChange }: PropsEditorProps = $props();

    type Field = {
        key: string;
        kind: "string" | "number" | "boolean" | "unsupported";
    };

    const kindOf = (node: unknown): Field["kind"] => {
        let current = node as Record<string, unknown> | null;
        while (
            current !== null &&
            typeof current === "object" &&
            "wrapped" in current &&
            typeof (current as { wrapped: unknown }).wrapped === "object" &&
            (current as { wrapped: unknown }).wrapped !== null
        ) {
            current = (current as { wrapped: Record<string, unknown> }).wrapped;
        }
        if (
            current !== null &&
            typeof current === "object" &&
            Array.isArray((current as { pipe?: unknown }).pipe)
        ) {
            const pipe = (current as { pipe: unknown[] }).pipe;
            if (pipe.length > 0) {
                current = pipe[0] as Record<string, unknown>;
            }
        }
        const type = (current as { type?: unknown } | null)?.type;
        if (type === "string") return "string";
        if (type === "number") return "number";
        if (type === "boolean") return "boolean";
        return "unsupported";
    };

    const fields = $derived.by((): Field[] => {
        const schema = composition.schema as unknown as
            | { type?: unknown; entries?: unknown }
            | undefined;
        if (
            schema?.type !== "object" ||
            schema.entries === null ||
            typeof schema.entries !== "object"
        ) {
            return [];
        }
        return Object.entries(schema.entries as Record<string, unknown>).map(
            ([key, node]) => ({ key, kind: kindOf(node) }),
        );
    });

    const error = $derived.by((): string | undefined => {
        if (composition.schema === undefined) return undefined;
        const result = safeParse(composition.schema, value);
        if (result.success) return undefined;
        return result.issues
            .map((issue) => {
                const path = issue.path
                    ?.map((item) => String(item.key))
                    .join(".");
                return `${path === undefined || path === "" ? "(root)" : path}: ${issue.message}`;
            })
            .join("; ");
    });

    const set = (key: string, next: unknown): void => {
        onChange({ ...value, [key]: next });
    };
</script>

{#if fields.length > 0}
    <section
        class="mt-4 rounded border border-line bg-panel p-3"
        aria-label="Composition props"
    >
        <h3 class="text-sm font-semibold">Props</h3>
        <div class="mt-2 space-y-2">
            {#each fields as field (field.key)}
                {@const current = value[field.key]}
                <label class="block">
                    <span class="mb-0.5 block text-xs text-muted"
                        >{field.key}</span
                    >
                    {#if field.kind === "string"}
                        <input
                            type="text"
                            value={typeof current === "string" ? current : ""}
                            oninput={(event) =>
                                set(
                                    field.key,
                                    (event.currentTarget as HTMLInputElement)
                                        .value,
                                )}
                            class="w-full rounded border border-line bg-studio px-2 py-1 text-sm text-ink"
                        />
                    {:else if field.kind === "number"}
                        <input
                            type="number"
                            value={typeof current === "number" ? current : 0}
                            oninput={(event) => {
                                const raw = (
                                    event.currentTarget as HTMLInputElement
                                ).value;
                                set(field.key, raw === "" ? 0 : Number(raw));
                            }}
                            class="w-full rounded border border-line bg-studio px-2 py-1 text-sm text-ink"
                        />
                    {:else if field.kind === "boolean"}
                        <input
                            type="checkbox"
                            checked={current === true}
                            onchange={(event) =>
                                set(
                                    field.key,
                                    (event.currentTarget as HTMLInputElement)
                                        .checked,
                                )}
                            class="h-4 w-4 accent-accent"
                        />
                    {:else}
                        <span class="block text-xs text-muted">
                            Unsupported field type — edit via code.
                        </span>
                    {/if}
                </label>
            {/each}
        </div>
        {#if error !== undefined}
            <p class="mt-2 text-xs text-red-400" role="alert">{error}</p>
        {/if}
    </section>
{/if}
