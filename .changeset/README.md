# Changesets

This folder drives versioning for the three published packages.

## Why `fixed`

`@svelte-motion/core`, `@svelte-motion/renderer` and `@svelte-motion/cli` are listed under
`fixed` in `config.json`, so they always share one version. That is not cosmetic: `cli`
pins `renderer` exactly, so versioning them independently would publish a `cli` that points
at a `renderer` which does not exist yet.

The private workspace members — `studio-ui`, `studio`, `web`, `examples` — are `ignore`d.
They are never published, so they never need a version bump.

## Adding a changeset

```bash
bun changeset
```

Pick the packages and the bump type (`patch` / `minor` / `major`), then write one plain
sentence about what changed and why. Because the three are `fixed`, selecting any one of
them bumps all three together.

If you change a published package and forget this step, CI fails on the
`changeset status` check.

## Cutting a release

```bash
bun run version-packages   # applies pending changesets: bumps versions + CHANGELOG
git add -A && git commit -m "chore(release): version packages"
git push
gh release create v<version> --generate-notes   # triggers .github/workflows/publish.yml
```

The workflow publishes; it never bumps. See `PUBLISHING.md` for the trusted-publishing
setup that makes provenance automatic.

## Not commit-message driven

Nothing here parses commit text. A `fix:` commit does **not** bump anything by itself — the
changeset file is the signal. That is deliberate: with three packages locked to one version,
an explicit record of intent beats inferring from commit subjects.
