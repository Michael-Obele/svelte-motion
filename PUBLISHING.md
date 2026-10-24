# Publishing

Three packages publish to npm under the `@svelte-motion` scope. The two apps are private.

Order matters: `cli` depends on `renderer`, and both apps consume `core`, so publish
lowest first.

## 1. Authenticate

```bash
bun login
```

Check it worked before continuing:

```bash
bun pm whoami
```

A `401 Unauthorized` here means the token in `~/.npmrc` is stale. Log in again rather than
publishing with an old token.

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
