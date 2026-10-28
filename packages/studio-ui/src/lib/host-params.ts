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
import { clampFrame, type CompositionConfig } from "@svelte-motion/core";

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
  /** `?frame=` clamped into `[0, durationInFrames - 1]` by the shared policy. */
  frame: number;
  /** Validated `?props=` output, or the composition's `defaultProps`. */
  inputProps: Record<string, unknown>;
  /** Set when `?props=` was supplied but unparseable or failed the schema. */
  validationError: string | undefined;
};

const parseFrame = (raw: string | null, durationInFrames: number): number => {
  const parsed = Number.parseInt(raw ?? "0", 10);

  return clampFrame(parsed, durationInFrames);
};

/**
 * Distinguishes the three `?props=` cases. Missing/empty means "use the
 * composition's defaults" (trusted by definition). Present-but-unparseable is a
 * caller error: report it and render the defaults so the mistake is visible
 * rather than blank. Present-and-parseable returns the object for validation.
 */
const parseProps = (
  raw: string | null,
):
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string }
  | { ok: "absent" } => {
  if (raw === null || raw === "") {
    return { ok: "absent" };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Invalid JSON: could not parse the ?props= object." };
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "Invalid JSON: ?props= must be a JSON object." };
  }

  return { ok: true, value: parsed as Record<string, unknown> };
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
  const defaults = (composition?.defaultProps ?? {}) as Record<string, unknown>;
  const frame = parseFrame(params.get("frame"), composition?.durationInFrames ?? 0);
  const parsed = parseProps(params.get("props"));

  // Absent `?props=` → the composition's own defaults, trusted by definition.
  if (parsed.ok === "absent") {
    return { frame, inputProps: defaults, validationError: undefined };
  }

  // Present but unparseable → report it, render the defaults so the mistake is
  // visible rather than blank.
  if (parsed.ok === false) {
    return { frame, inputProps: defaults, validationError: parsed.error };
  }

  // Present and parseable → validate when a schema exists. On success pass the
  // validated output (transforms and schema defaults applied) to the
  // composition, never the raw parsed object.
  if (composition?.schema !== undefined) {
    const result = v.safeParse(composition.schema, parsed.value);

    if (!result.success) {
      return { frame, inputProps: defaults, validationError: formatIssues(result.issues) };
    }

    return {
      frame,
      inputProps: result.output as Record<string, unknown>,
      validationError: undefined,
    };
  }

  return { frame, inputProps: parsed.value, validationError: undefined };
};
