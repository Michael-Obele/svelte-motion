/**
 * Shared resolution for the `/render` and `/player` pixel hosts.
 *
 * Both hosts accept the same query string — `?composition=<id>&frame=<n>&props=<url-encoded
 * JSON>` — and both must derive the same three values from it. Keeping that in one
 * function is what makes the parity gate meaningful: `/render` and `/player` cannot
 * disagree about which frame or which props they were asked for, because there is
 * only one implementation.
 *
 * Host apps call this with their own `URLSearchParams`; nothing here reads the URL.
 */

import * as v from "valibot";
import type { CompositionConfig } from "@svelte-motion/core";

/**
 * The only part of `URLSearchParams` these hosts need.
 *
 * SvelteKit hands routes a `ReadonlyURLSearchParams` (no `set`/`delete`), so a
 * narrow read-only shape lets both a plain `URLSearchParams` and SvelteKit's type
 * satisfy it without a cast at every call site.
 */
export type QueryParams = { get(name: string): string | null };

/** Everything a host component needs, derived from the query string. */
export type ResolvedHostProps = {
  /** `?frame=` as a non-negative integer. Unusable input falls back to 0. */
  frame: number;
  /** `?props=` as a plain object, or the composition's `defaultProps`. */
  inputProps: Record<string, unknown>;
  /** Set when `?props=` was supplied but failed the composition's schema. */
  validationError: string | undefined;
};

const parseFrame = (raw: string | null): number => {
  const parsed = Number.parseInt(raw ?? "0", 10);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const parseProps = (
  raw: string | null,
  composition: CompositionConfig | undefined,
): Record<string, unknown> => {
  if (raw !== null && raw !== "") {
    try {
      const parsed: unknown = JSON.parse(raw);

      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // A malformed `?props=` is a caller error, not a page crash: fall through
      // to the defaults so the frame still renders and the mistake is visible.
    }
  }

  return (composition?.defaultProps ?? {}) as Record<string, unknown>;
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

/**
 * Resolve `?frame=` and `?props=` for one composition.
 *
 * Validation only runs when `?props=` was actually supplied: without it the props
 * are the composition's own defaults, which are trusted by definition. That rule is
 * stated once here rather than repeated in every host route.
 */
export const resolveHostProps = (
  composition: CompositionConfig | undefined,
  params: QueryParams,
): ResolvedHostProps => {
  const rawProps = params.get("props");
  const parsedProps = parseProps(rawProps, composition);

  let validationError: string | undefined;

  if (
    composition !== undefined &&
    composition.schema !== undefined &&
    rawProps !== null &&
    rawProps !== ""
  ) {
    const result = v.safeParse(composition.schema, parsedProps);

    if (!result.success) {
      validationError = formatIssues(result.issues);
    }
  }

  return {
    frame: parseFrame(params.get("frame")),
    // Invalid props fall back to the defaults, so the frame still renders and the
    // error is visible rather than blank.
    inputProps:
      validationError === undefined
        ? parsedProps
        : ((composition?.defaultProps ?? {}) as Record<string, unknown>),
    validationError,
  };
};
