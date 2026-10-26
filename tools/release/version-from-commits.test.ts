import { describe, expect, test } from "bun:test";
import { computeBump, levelFor } from "./version-from-commits.ts";

describe("levelFor", () => {
  test("any ordinary commit is a minor", () => {
    expect(levelFor("feat(core): add thing").level).toBe("minor");
    expect(levelFor("fix: repair thing").level).toBe("minor");
    expect(levelFor("random words with no type").level).toBe("minor");
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
