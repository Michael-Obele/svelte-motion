/**
 * Verify every badge image referenced from a README actually resolves and has
 * text in it. A badge URL that 404s renders as a broken image, and one that
 * resolves with no data renders as an empty pill — both look worse than no badge.
 *
 * Usage: bun run tools/release/check-badges.ts README.md packages/core/README.md ...
 */

const files = process.argv.slice(2);

if (files.length === 0) {
  console.error("usage: bun tools/release/check-badges.ts <readme...>");
  process.exit(1);
}

const IMAGE = /!\[[^\]]*\]\((https:\/\/[^)\s]+)\)/g;

type Result = { file: string; url: string; status: string; ok: boolean };

const results: Result[] = [];

for (const file of files) {
  const text = await Bun.file(file).text();

  for (const match of text.matchAll(IMAGE)) {
    const url = match[1];

    if (!url.includes("img.shields.io") && !url.includes("/badge.svg")) {
      continue;
    }

    try {
      const response = await fetch(url);

      if (!response.ok) {
        results.push({ file, url, status: `HTTP ${response.status}`, ok: false });
        continue;
      }

      // shields.io renders an empty pill when it has no data, so parse the SVG
      // and require at least one text node with content. GitHub's own workflow
      // badges put their status in `<title>` rather than a `<text>` node
      // ("ci - failing"), so both shapes count as data.
      const body = await response.text();
      const hasText =
        [...body.matchAll(/>([^<>]{2,})<\/text>/g)].some((node) => node[1].trim().length > 0) ||
        [...body.matchAll(/<title>([^<]+)<\/title>/g)].some((node) => node[1].trim().length > 0);

      results.push({
        file,
        url,
        status: hasText ? "ok" : "no data in badge",
        ok: hasText,
      });
    } catch (error) {
      results.push({
        file,
        url,
        status: error instanceof Error ? error.message : String(error),
        ok: false,
      });
    }
  }
}

for (const { file, url, status, ok } of results) {
  console.log(`${ok ? "ok  " : "FAIL"} ${file}  ${status.padEnd(18)} ${url}`);
}

const failed = results.filter((entry) => !entry.ok).length;
console.log(`\n${results.length} badge(s), ${failed} unusable`);

process.exitCode = failed === 0 ? 0 : 1;
