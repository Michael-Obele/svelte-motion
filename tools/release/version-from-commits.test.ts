import { describe, expect, test } from "bun:test";
import {
  changesetTypeFor,
  computeBump,
  isReleaseCommit,
  levelFor,
} from "./version-from-commits.ts";

describe("isReleaseCommit", () => {
  test("a merged version pull request is a release commit", () => {
    expect(isReleaseCommit("Merge pull request #3 from Michael-Obele/changeset-release/main")).toBe(
      true,
    );
  });

  test("the action's own version commit is a release commit", () => {
    expect(isReleaseCommit("chore(release): version packages")).toBe(true);
  });

  test("real work is not a release commit", () => {
    expect(isReleaseCommit("feat(core): add thing")).toBe(false);
    expect(isReleaseCommit("docs: readme")).toBe(false);
    // A merge of ordinary work must still bump.
    expect(isReleaseCommit("Merge pull request #9 from someone/feature-branch")).toBe(false);
  });
});

describe("levelFor", () => {
  test("a feature is a minor", () => {
    expect(levelFor("feat(core): add thing").level).toBe("minor");
    expect(levelFor("random words with no type").level).toBe("minor");
  });

  test("a fix is a patch, not a feature", () => {
    expect(levelFor("fix: repair thing").level).toBe("patch");
    expect(levelFor("fix(release): dispatch publish").level).toBe("patch");
    expect(levelFor("perf(renderer): faster encode").level).toBe("patch");
    expect(levelFor("refactor(core): tidy").level).toBe("patch");
    expect(levelFor("revert: undo thing").level).toBe("patch");
  });

  test("breaking markers are major", () => {
    expect(levelFor("feat(core)!: drop the old API").level).toBe("major");
    expect(levelFor("fix(renderer)!: change signature").level).toBe("major");
    expect(levelFor("feat: something\n\nBREAKING CHANGE: gone").level).toBe("major");
  });

  test("non-shipping types are patch", () => {
    for (const message of [
      "docs: rewrite readme",
      "chore: tidy",
      "ci: add job",
      "test: more cases",
      "style: format",
      "build: bump vite",
      "chore(deps): bump bun",
    ]) {
      expect(levelFor(message).level).toBe("patch");
    }
  });

  test("a bang in prose is not breaking", () => {
    expect(levelFor("docs: wow! nice").level).toBe("patch");
  });
});

describe("changesetTypeFor", () => {
  test("a feature is still only a patch", () => {
    expect(changesetTypeFor("minor")).toBe("patch");
  });

  test("a breaking change is still only a patch", () => {
    expect(changesetTypeFor("major")).toBe("patch");
  });

  test("a fix is a patch", () => {
    expect(changesetTypeFor("patch")).toBe("patch");
  });

  test("the commit level never reaches the changeset", () => {
    // The level is an audit trail, not a decision. A minor or major has to be a
    // hand-written changeset, which wins over this generator.
    for (const level of ["patch", "minor", "major"] as const) {
      expect(changesetTypeFor(level)).toBe("patch");
    }
  });
});

describe("computeBump", () => {
  test("highest level across the range wins", () => {
    expect(computeBump(["docs: a", "chore: b", "feat: c"]).level).toBe("minor");
    expect(computeBump(["docs: a", "feat!: b"]).level).toBe("major");
  });

  test("a range of only non-shipping commits is a patch", () => {
    expect(computeBump(["docs: a", "ci: b", "test: c"]).level).toBe("patch");
  });

  test("an empty range is a patch, not a minor", () => {
    expect(computeBump([]).level).toBe("patch");
  });

  test("evidence names every commit", () => {
    const { evidence } = computeBump(["feat: a", "docs: b"]);
    expect(evidence).toHaveLength(2);
    expect(evidence[0]).toContain("feat: a");
  });
});
