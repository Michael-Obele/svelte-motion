/**
 * Turn commit messages into a changeset.
 *
 * Changesets has no opinion about commits: a version only moves when a human
 * writes a `.changeset/*.md` file. That is a good default for a library with
 * outside contributors, and a bad one for a repo where every change already
 * lands as a conventional commit — the changeset becomes a second, forgotten
 * description of the same diff.
 *
 * So: **any commit bumps `minor`**, and only specific messages override that.
 * `major` needs a breaking marker, and a range that touched nothing a consumer
 * runs (docs, chore, ci, test, style) drops to `patch`.
 *
 * The rules live in `BUMP_RULES` below, in priority order, first match wins per
 * commit and the highest level across all commits wins. Edit that table, not the
 * logic.
 *
 * A changeset written by hand always wins: if any changeset already exists this
 * script does nothing. It is a floor, not a competitor.
 */

import { resolve } from "node:path";

export type BumpLevel = "major" | "minor" | "patch";

/** Highest wins. Order matters: the first rule a message matches decides it. */
export const BUMP_RULES: ReadonlyArray<{
  level: BumpLevel;
  reason: string;
  test: (message: string) => boolean;
}> = [
  {
    level: "major",
    reason: "breaking change marker",
    // `feat!:` / `fix(scope)!:` anywhere in a subject, or a BREAKING CHANGE footer.
    test: (message) => /^[a-z]+(\([^)]+\))?!:/.test(message) || /BREAKING[ -]CHANGE/.test(message),
  },
  {
    level: "patch",
    reason: "no shipped behaviour",
    // Only these types, so the range has to be all of them to stay a patch.
    test: (message) => /^(docs|chore|ci|test|style|build)(\([^)]+\))?:/.test(message),
  },
  {
    level: "minor",
    reason: "default for any change",
    test: () => true,
  },
];

const ORDER: Record<BumpLevel, number> = { patch: 0, minor: 1, major: 2 };

/** The level one commit asks for. */
export const levelFor = (message: string): { level: BumpLevel; reason: string } => {
  const rule = BUMP_RULES.find((candidate) => candidate.test(message));

  // `BUMP_RULES` ends with a catch-all, so this is unreachable unless the table
  // is edited to drop it. Failing loudly beats silently skipping a commit.
  if (rule === undefined) {
    throw new Error(
      `No bump rule matched ${JSON.stringify(message)}. BUMP_RULES needs a catch-all.`,
    );
  }

  return { level: rule.level, reason: rule.reason };
};

export type ComputedBump = {
  level: BumpLevel;
  /** One line per commit that decided it — enough to audit without reading the log. */
  evidence: string[];
};

/**
 * The level for a whole range.
 *
 * Highest wins, and a range is only as low as its *least* significant commit:
 * one `feat` among ten `docs` commits is still a minor.
 */
export const computeBump = (messages: readonly string[]): ComputedBump => {
  if (messages.length === 0) {
    return { level: "patch", evidence: ["no commits since the last tag"] };
  }

  let level: BumpLevel = "patch";
  const evidence: string[] = [];

  for (const message of messages) {
    const verdict = levelFor(message);
    if (ORDER[verdict.level] > ORDER[level]) {
      level = verdict.level;
    }
    evidence.push(`${verdict.level} (${verdict.reason}) — ${message}`);
  }

  return { level, evidence };
};

/* -------------------------------------------------------------------------- */
/* CLI                                                                        */
/* -------------------------------------------------------------------------- */

const git = (args: string[]): string => {
  const result = Bun.spawnSync(["git", ...args]);
  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.toString().trim()}`);
  }
  return result.stdout.toString();
};

/** Last tag reachable from HEAD, or empty when the repo has never tagged. */
const lastTag = (): string => {
  const result = Bun.spawnSync(["git", "describe", "--tags", "--abbrev=0"]);

  return result.exitCode === 0 ? result.stdout.toString().trim() : "";
};

const main = async (): Promise<number> => {
  const root = resolve(import.meta.dir, "../..");
  const changesetDir = resolve(root, ".changeset");

  const pending = Array.from(
    new Bun.Glob("*.md").scanSync({ cwd: changesetDir, absolute: true }),
  ).filter((path) => !path.endsWith("README.md"));

  if (pending.length > 0) {
    console.log(
      `changeset:auto: ${pending.length} changeset(s) already exist — leaving them alone.`,
    );
    return 0;
  }

  const tag = lastTag();
  const range = tag === "" ? "HEAD" : `${tag}..HEAD`;
  const raw = git(["log", range, "--format=%s%n%b%x00"]).trim();

  const messages = raw
    .split("\0")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const { level, evidence } = computeBump(messages);

  console.log(`changeset:auto: range ${range} (${messages.length} commit(s))`);
  for (const line of evidence) {
    console.log(`  ${line}`);
  }
  console.log(`changeset:auto: bump → ${level}`);

  // The packages a bump applies to come from the same place changesets reads, so
  // the fixed group is never duplicated into this script.
  const config = (await Bun.file(resolve(changesetDir, "config.json")).json()) as {
    fixed?: string[][];
  };
  const packages = config.fixed?.flat() ?? [];

  if (packages.length === 0) {
    console.log("changeset:auto: no fixed group in config.json, nothing to write.");
    return 0;
  }

  const summary = messages
    .map((message) => `- ${message.split("\n")[0]}`)
    .slice(0, 20)
    .join("\n");

  const body = [
    "---",
    ...packages.map((name) => `"${name}": ${level}`),
    "---",
    "",
    summary,
    "",
    "<!-- generated by tools/release/version-from-commits.ts -->",
    "",
  ].join("\n");

  await Bun.write(resolve(changesetDir, "auto-generated.md"), body);
  console.log(`changeset:auto: wrote .changeset/auto-generated.md (${level} × ${packages.length})`);

  return 0;
};

if (import.meta.main) {
  process.exitCode = await main();
}
