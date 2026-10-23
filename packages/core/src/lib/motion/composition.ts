/**
 * The composition registry.
 *
 * A composition is a Svelte component plus the video config it is meant to be
 * rendered at. Registration is explicit — `defineComposition` — and discovery is
 * a thin helper over a Vite glob the *app* owns.
 *
 * Why the glob lives in the app: `import.meta.glob` is resolved by Vite at build
 * time relative to the module that contains it, so a glob written inside this
 * package would only ever see this package's files. The app passes its own glob
 * result in, and `collectCompositions` does the rest.
 */

import type { Component } from "svelte";
import { safeParse, type GenericSchema } from "valibot";

/** A component plus the shape it must be rendered at. */
export type CompositionConfig<Props extends Record<string, unknown> = Record<string, unknown>> = {
  /** Kebab-case, unique. Used as `?composition=<id>`. */
  id: string;
  component: Component<Props>;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  /** Must be JSON-serialisable: it travels through the URL as `?props=`. */
  defaultProps?: Props;
  /**
   * Optional valibot schema for `defaultProps`.
   *
   * The props reach a composition through the URL, so a typo in a query string
   * is a runtime surprise nobody sees until the render is wrong. Registering a
   * schema turns that into a registration-time error.
   */
  schema?: GenericSchema<unknown, Props>;
};

const formatIssues = (
  issues: readonly { path?: readonly { key: unknown }[]; message: string }[],
): string =>
  issues
    .map((issue) => {
      const path = issue.path?.map((item) => String(item.key)).join(".");
      return `${path === undefined || path === "" ? "(root)" : path}: ${issue.message}`;
    })
    .join("; ");

const registry = new Map<string, CompositionConfig>();

/**
 * Registers a composition.
 *
 * @returns The same config, so the file can `export default defineComposition(...)`
 * @throws If `id` is taken, or the video config is not a positive integer set
 */
export const defineComposition = <Props extends Record<string, unknown>>(
  config: CompositionConfig<Props>,
): CompositionConfig<Props> => {
  if (!config.id) {
    throw new Error("defineComposition() needs an id");
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(config.id)) {
    throw new Error(`Composition id "${config.id}" must be kebab-case, e.g. "hello-world"`);
  }

  for (const key of ["width", "height", "fps", "durationInFrames"] as const) {
    const value = config[key];
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(
        `Composition "${config.id}" needs a positive integer ${key}, but got ${value}`,
      );
    }
  }

  if (registry.has(config.id)) {
    throw new Error(`Composition id "${config.id}" is already registered`);
  }

  if (config.schema !== undefined && config.defaultProps !== undefined) {
    const result = safeParse(config.schema, config.defaultProps);

    if (!result.success) {
      throw new Error(
        `Composition "${config.id}" defaultProps do not match its schema — ${formatIssues(result.issues)}`,
      );
    }
  }

  registry.set(config.id, config as CompositionConfig);
  return config;
};

/** Every registered composition, in registration order. */
export const getCompositions = (): CompositionConfig[] => [...registry.values()];

/** One composition by id, or `undefined`. */
export const getComposition = (id: string): CompositionConfig | undefined => registry.get(id);

/** Registration is global; tests use this to start clean. */
export const clearCompositions = (): void => {
  registry.clear();
};

/**
 * Registers every composition found by an app-owned glob.
 *
 * ```ts
 * const compositions = collectCompositions(
 *   import.meta.glob("/src/compositions/*\/index.ts", { eager: true }),
 * );
 * ```
 *
 * @param modules - Result of an eager `import.meta.glob`, each with a default export
 */
export const collectCompositions = (
  modules: Record<string, { default?: unknown }>,
): CompositionConfig[] => {
  const collected: CompositionConfig[] = [];

  for (const [path, module] of Object.entries(modules)) {
    const config = module.default;

    if (config === undefined) {
      throw new Error(`Composition file "${path}" has no default export`);
    }

    const candidate = config as Partial<CompositionConfig>;
    if (typeof candidate.id !== "string" || candidate.component === undefined) {
      throw new Error(`Composition file "${path}" must default-export defineComposition({...})`);
    }

    // defineComposition already registered it when the module was evaluated.
    // Registering again would throw, so only add what the registry has not seen.
    collected.push(registry.get(candidate.id) ?? defineComposition(candidate as CompositionConfig));
  }

  return collected;
};
