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

## 3. Publish, in order

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

All three move together on the same version. Bump with:

```bash
cd packages/core && bunx bumpp --no-tag
```

then repeat for `renderer` and `cli`, and update the `cli` dependency range if it pins an
exact version.

## Tags

`bun publish` sends `latest` by default. Publish a pre-release with `--tag next` so
`npm install @svelte-motion/core` keeps resolving the stable version.
