# Publishing

Three packages publish to npm under the `@svelte-motion` scope. The two apps are private.

Order matters: `cli` depends on `renderer`, and both apps consume `core`, so publish
lowest first.

## 1. Authenticate

`bun login` does **not** exist. Bun reserves the subcommand and exits with:

```
Uh-oh. bun login is a subcommand reserved for future use by Bun.
```

So authenticate with the real npm CLI. One thing will bite first: npm refuses to run
**inside this repo**, because the root `devEngines` pins Bun and npm exits with
`EBADDEVENGINES Invalid name "bun" does not match "npm"`. Run it from your home directory.

```bash
cd ~
npm login           # web auth; writes //registry.npmjs.org/:_authToken to ~/.npmrc
```

Verify from anywhere — this one is a Bun command and works fine:

```bash
bun pm whoami       # prints your npm username
```

A `401 Unauthorized` means the token in `~/.npmrc` is stale. Log in again rather than
publishing with an old token.

If the machine has no browser for web auth, create a _Granular Access Token_ on npmjs.com
(read + write, restricted to the `@svelte-motion` scope, with 2FA bypass if you use it in
CI later) and add it to `~/.npmrc`:

```
//registry.npmjs.org/:_authToken=npm_...
```

## 2. Build and verify

```bash
vp run -r build
vp check
vp run -r test
bun run tools/spike/verify-determinism.ts
```

The determinism gate is not optional before a release: it proves the renderer still
produces identical bytes, which is the product.

## 3. Publish, in order (first release only)

This manual path exists for the very first publish of a package. After that, releases go
through CI — see [Releases from CI](#releases-from-ci-trusted-publishing--provenance).

```bash
cd packages/core     && bun publish
cd ../renderer       && bun publish
cd ../cli            && bun publish
```

Each package builds itself in `prepublishOnly`. `bun publish` rewrites the `workspace:*`
dependency in `cli` to the published version, so `renderer` must already be on the
registry.

Dry run first if you want to inspect the tarball without uploading:

```bash
cd packages/core && bun publish --dry-run
```

## 4. Verify

```bash
cd ~                # npm cannot run inside this repo — see step 1
npm view @svelte-motion/core version
npm view @svelte-motion/cli dependencies
```

The second command should show `@svelte-motion/renderer` at the published version, not
`workspace:*`.

## Versioning

Versions are driven by [changesets](https://github.com/changesets/changesets), configured in
`.changeset/config.json`. The three published packages are in a `fixed` group, so they always
share one version — `cli` pins `renderer` exactly, so versioning them apart would ship a `cli`
pointing at a `renderer` that does not exist yet.

### Every PR that changes a published package

```bash
bun changeset
```

Pick the bump type (`patch` / `minor` / `major`) and write one plain sentence about what
changed. Selecting any one of the three bumps all three, because of the `fixed` group. Commit
the generated `.changeset/*.md` with the change itself.

`.github/workflows/ci.yml` runs `changeset status` on every pull request, so a package change
with no changeset fails CI.

### Cutting the release

```bash
bun run version-packages        # applies pending changesets: versions + CHANGELOG.md
git add -A && git commit -m "chore(release): version packages"
git push
gh release create v0.2.0 --generate-notes   # triggers publish.yml
```

`changeset version` leaves `"workspace:*"` untouched in `cli`, which is what we want: pnpm
rewrites it to the real version when it packs the tarball.

The CI workflow publishes whatever version each `package.json` declares. A version already on
the registry fails the job, so the bump is not optional.

### Not commit-message driven

Nothing parses commit text. A `fix:` commit does not bump anything on its own — the changeset
file is the signal. With three packages locked to one version, an explicit record of intent
beats inferring from commit subjects.

## Tags

`bun publish` sends `latest` by default. Publish a pre-release with `--tag next` so
`npm install @svelte-motion/core` keeps resolving the stable version.

## Releases from CI (trusted publishing + provenance)

After the first release, publish from GitHub Actions rather than from a laptop. The
workflow at `.github/workflows/publish.yml` uses **trusted publishing**: there is no npm
token in the repository, in secrets, or in the workflow. GitHub mints a short-lived OIDC
token, npm exchanges it for a publish credential, and npm attaches a **provenance
attestation** automatically — no `--provenance` flag is needed.

### One-time setup, per package

On npmjs.com, for **each** of `@svelte-motion/core`, `renderer`, `cli`: open _Settings →
Trusted publishing → GitHub Actions_ and fill in:

| Field                | Value           |
| -------------------- | --------------- |
| Organization or user | `Michael-Obele` |
| Repository           | `svelte-motion` |
| Workflow filename    | `publish.yml`   |
| Environment          | _(blank)_       |

Three details that decide whether this works:

- The workflow filename must match **exactly**, including `.yml`. npm does not validate the
  form when you save it, so a typo appears later as `ENEEDAUTH` at publish time.
- The repository must be **public**. Provenance is never emitted for private repositories,
  even when the package itself is public.
- A newly created trusted publisher **expires after two days** unless it completes one
  successful publish. Set it up when you are ready to release, not weeks ahead.

### Releasing

```bash
# 1. bump all three (see Versioning), commit
# 2. tag and publish a GitHub release; `release: published` triggers the workflow
gh release create v0.1.1 --generate-notes
```

The workflow builds, tests, and publishes `core → renderer → cli`. Order matters: `cli`
depends on `renderer`.

### Why pnpm and not bun or npm

- `bun publish` has no way to do trusted publishing or provenance.
- `npm publish` does **not** rewrite `workspace:*`; the packed `cli` manifest would point at
  the literal string `workspace:*`, which is unresolvable from the registry.
- `pnpm publish` rewrites it to the real version **and** attaches provenance on its own
  under trusted publishing.

`pnpm` is used only to publish. `bun` still installs and builds, because `bun.lock` is the
lockfile. This is also why the root `devEngines.packageManager.onFail` is `warn`: pnpm
refuses to run at all when the project pins a different package manager as an error.

### Verifying provenance

```bash
cd ~
npm view @svelte-motion/core --json | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const v=JSON.parse(s);console.log(v.dist.attestations)})'
```

A non-null `attestations` object means the registry verified the build. The package page on
npmjs.com shows a provenance badge too. Versions published before trusted publishing was
configured (`0.1.0` and the `0.0.0-stage` tags) will never have one — attestations are
minted at publish time and cannot be added retroactively.

### Disabling provenance

If a release must go out without it — for example a one-off manual publish — pass
`--no-provenance`, or set `"provenance": false` in that package's `publishConfig`. Both are
escape hatches; neither should be used for normal releases.
