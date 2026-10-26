# npm packaging and ephemeris data distribution

- Status: accepted
- Date: 2026-10-26
- Deciders: maintainers

Technical story: make every `@node-jhora/*` package publishable to npm,
including the ephemeris data, without publishing anything yet.

## Context and Problem Statement

The code packages are small, but the ephemeris data is not. DE440s
(`de440s.bsp`) is 32.7 MB. The DE431 long-range chunk set
(`@node-jhora/ephe-long`, 400 `.njce` files) is 2.18 GB. Before this ADR,
`npm pack` for `@node-jhora/ephe-long` would have put all 2.18 GB in one
tarball (2,069 MB packed). Every code package also shipped its source maps.
`@node-jhora/ephe` fetched its kernel in a `postinstall` script. npm v12 and
pnpm 10+ no longer run dependency install scripts by default, so that script
would silently do nothing for most users.

How should the packages and the data be laid out on npm so that installs are
small, offline use works, nothing runs at install time, and every byte the
engine reads is still the cited JPL dataset, with no loss of precision?

## Decision Drivers

- No install-time scripts. npm v12 turns `allowScripts` off by default
  ([GitHub changelog, 2026-07-08](https://github.blog/changelog/2026-07-08-npm-install-time-security-and-gat-bypass2fa-deprecation/)),
  and pnpm 10 stopped running dependency lifecycle scripts
  ([pnpm v10.0.0](https://github.com/pnpm/pnpm/releases/tag/v10.0.0)).
- Code packages stay small. A user who never asks for dates before 1550 CE
  should not download gigabytes.
- Offline and air-gapped installs must work. CI and servers should be able to
  prefetch data once and run with no network.
- Integrity. Every data file is checked against a SHA-256 pinned in source
  before it is used.
- Clean room ([ADR 0002](0002-clean-room-policy.md)). Only cited primary JPL
  data, with provenance next to it. No precision loss
  ([ADR 0003](0003-pure-typescript-de440s-ephemeris.md)): the bytes are the
  same bytes, only the delivery changes.
- Registry and CDN limits. jsDelivr serves npm packages up to 150 MB
  ([jsDelivr restrictions](https://github.com/jsdelivr/jsdelivr#restrictions)),
  and very large tarballs are a known pain point for the npm registry
  ([npm/npm#12750](https://github.com/npm/npm/issues/12750)).

## Considered Options

1. One data package with everything (status quo for `ephe-long`).
2. `postinstall` download (status quo for `ephe`).
3. Data split into versioned npm packages, a hash manifest in core, and a
   runtime resolver: installed package → local cache → configurable remote,
   with a prefetch CLI.
4. Data only from a remote URL or object store, nothing on npm.

## Decision Outcome

Chosen option: 3, "split data packages + manifest + runtime resolver",
because it is the only option with no install scripts, small default
installs, offline support and pinned integrity together. It is also the
pattern the wider ecosystem settled on:

- **esbuild 0.13** and **sharp 0.33** dropped their install scripts and moved
  large binaries into separate packages that the package manager installs
  directly
  ([esbuild v0.13.0](https://github.com/evanw/esbuild/releases/tag/v0.13.0),
  [sharp installation](https://sharp.pixelplumbing.com/install)).
- **Skyfield** loads JPL kernels at runtime into a cache directory you can
  point anywhere and pre-populate
  ([Skyfield data files](https://rhodesmill.org/skyfield/files.html)).
- **Playwright** keeps browsers out of the npm package and downloads them on
  demand into a cache, with an overridable host and path
  (`PLAYWRIGHT_DOWNLOAD_HOST`, `PLAYWRIGHT_BROWSERS_PATH`)
  ([Playwright browsers](https://playwright.dev/docs/browsers)).
- **Python `tzdata`** (PEP 615) ships timezone data as a separate,
  independently versioned package that the code package uses as a fallback
  ([PEP 615](https://peps.python.org/pep-0615/),
  [tzdata](https://pypi.org/project/tzdata/)).
- **Fontsource** publishes data-only npm packages that browsers load straight
  from jsDelivr ([Fontsource CDN](https://fontsource.org/docs/getting-started/cdn)).

### What ships where

| Package                                        | Contents                                                                                                                                                                                                           | Packed size                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| `@node-jhora/core` and the other code packages | `dist/` JS + `.d.ts` only. No source maps, no data. Core also ships `node/` helpers, the `node-jhora-ephe` CLI and the hash manifest.                                                                              | 5 KB – 140 KB each                     |
| `@node-jhora/ephe`                             | `de440s.bsp` (pinned, verified at `prepack`), `NOTICE.md` with provenance. No install script. Optional peer of core.                                                                                               | 31 MB                                  |
| `@node-jhora/ephe-long`                        | Format spec, notice, and the deterministic chunk builder. No data.                                                                                                                                                 | 7 KB                                   |
| `@node-jhora/ephe-de431-{p\|m}{year}` ×40      | Ten `.njce` files each (500 years of g0 + g1 chunks), `NOTICE.md` with per-file hashes. Generated by `packages/ephe-long/scripts/stage-data-packages.mjs`. Version `431.1.0` tracks the data format, not the code. | 51.7 MB each (under jsDelivr's 150 MB) |

### Resolution order

Node (`@node-jhora/core/node/register.mjs`, `@node-jhora/core/node/ephemeris`):

1. Explicit path: `NODE_JHORA_EPHE_PATH` / `NODE_JHORA_EPHE_LONG_DIR`, or the
   `dirs` option.
2. Installed data package (`@node-jhora/ephe`, `@node-jhora/ephe-de431-*`).
3. Cache: `NODE_JHORA_CACHE_DIR`, else `$XDG_CACHE_HOME/node-jhora`, else
   the platform cache directory (`~/.cache/node-jhora`,
   `~/Library/Caches/node-jhora`, `%LOCALAPPDATA%\node-jhora\Cache`). Files land there atomically (`.partial` + rename)
   and only after their hash matches.
4. Remote: DE440s defaults to JPL, then the jsDelivr mirror of the immutable
   `@node-jhora/ephe@440.2.0` tarball. DE431 chunks have no default remote;
   pass `baseUrl`, `urlFor` or `cdn: true` (jsDelivr per data package).
   `NODE_JHORA_OFFLINE=1` or `offline: true` turns the remote off.

`npx node-jhora-ephe prefetch de440s` and
`npx node-jhora-ephe prefetch de431 --from 1500 --to 1999 --cdn` fill the
cache ahead of time; `node-jhora-ephe verify` re-hashes a directory and exits
non-zero on any mismatch.

Browsers: the same manifest and `verifyingChunkLoader` /
`firstAvailableChunkLoader` from `@node-jhora/core` wrap any fetch-based
loader. JPL's servers send no CORS headers, so a browser cannot read the
kernel from JPL directly; use the jsDelivr URL
(`de440sCdnUrl()`, `njceCdnUrl()`, which send
`access-control-allow-origin: *`) or self-host the files.

### Integrity

`packages/core/src/ephemeris-data/manifest.generated.ts` pins byte size and
SHA-256 for DE440s and all 400 NJCE chunks. It is generated by
`packages/ephe-long/scripts/generate-manifest.mjs` from the deterministic
build. Cache, remote and NJCE bytes are always fully hashed. A copy that
came from an installed package or an explicit path is size-checked only, to
stay inside the 150 ms engine-init budget; `NODE_JHORA_VERIFY=full` hashes
those too. A mismatch throws `EphemerisIntegrityError` and the bad file is
never written to, or kept in, the cache.

### Gates

`pnpm check:pack` (`scripts/check-pack.mjs`, CI workflow `pack.yml`) runs
`npm pack --dry-run` on every publishable package and fails on: unpacked size
over budget (1 MB for code, 40 MB for `@node-jhora/ephe`); source maps,
`.tsbuildinfo`, tests, fixtures, `.partial`, or `.bsp`/`.njce` outside the
data allowlist; a missing README or LICENSE/NOTICE; a wrong
`repository.url`; any install lifecycle script; or any
[publint](https://publint.dev/) (`--strict`) or
[attw](https://arethetypeswrong.github.io/) (`--profile esm-only`) problem.

### Consequences

- Good, because a default install is about 31 MB (core + DE440s) instead of
  2 GB, and code-only consumers get under 200 KB per package.
- Good, because nothing runs at install time, so npm v12 and pnpm behave the
  same as npm 10.
- Good, because the engine reads exactly the bytes the manifest pins, so
  output is byte-identical to before.
- Bad, because 40 extra package names must be reserved and published per
  data version. The staging script generates them; publishing them is a
  release step, not a code step.
- Bad, because `@node-jhora/ephe` is now an optional peer. Users who skip it
  get a one-time 32 MB download into the cache on first use (or must
  prefetch for offline use).

## Pros and Cons of the Options

### 1. One data package

- Good, because it is one name and one install.
- Bad, because 2 GB per install, over jsDelivr's 150 MB limit, and far past
  what the registry handles well.

### 2. `postinstall` download

- Good, because the tarball stays small.
- Bad, because npm v12 and pnpm skip it by default, it breaks offline and
  `--ignore-scripts` installs, and it is the install-time code-execution path
  the ecosystem is moving away from.

### 3. Split data packages + manifest + resolver (chosen)

- Good, for the reasons above.
- Bad, because there are more packages to publish and keep in step with the
  manifest.

### 4. Remote only

- Good, because nothing large touches npm.
- Bad, because it needs a hosted bucket we would have to run and pay for,
  offline installs become a separate story, and there is no immutable
  versioned mirror like jsDelivr gives npm tarballs for free.

## Eventual publish setup (parent repo, later)

Nothing in this ADR publishes. `release.yml` stays dry-run by default. When
publishing is set up in `HariEshwar-J-A/node-jhora`, it needs:

1. **npm org and names.** The `@node-jhora` scope must be owned by the
   publishing account. Reserve `@node-jhora/format`, `@node-jhora/engine`,
   `@node-jhora/ephe-long` and the 40 `@node-jhora/ephe-de431-*` names.
   Versions already on npm (code `3.1.0`, `@node-jhora/ephe@440.2.0` with its
   old `postinstall`) cannot be republished; the changesets in this repo bump
   past them.
2. **Auth.** Prefer npm trusted publishing (OIDC from GitHub Actions, no
   long-lived token) and `--provenance`
   ([trusted publishers](https://docs.npmjs.com/trusted-publishers),
   [provenance](https://docs.npmjs.com/generating-provenance-statements)).
   Provenance needs a public repository whose URL matches `repository.url`
   in every `package.json` (already `HariEshwar-J-A/node-jhora`). The
   workflow needs `id-token: write`.
3. **Code packages.** `pnpm build && pnpm check:pack && pnpm changeset
publish`. pnpm rewrites `workspace:` ranges at publish time.
4. **`@node-jhora/ephe`.** Its `prepack` runs `download.mjs`, which fetches
   and verifies the kernel against the pinned SHA-256 before the tarball is
   built.
5. **DE431 data packages.** A separate, manually triggered job: build or
   restore the 400 chunks, run
   `node packages/ephe-long/scripts/stage-data-packages.mjs --out .release/ephe-de431`
   (it re-verifies every chunk against the manifest), then `npm publish` each
   staged directory. Publish only when `NJCE_DATA_VERSION` changes; the data
   packages are immutable per version.
6. **Licences.** Confirm the wording for the JPL data
   (`LicenseRef-NASA-Open-Government`) and the code licence
   (`LicenseRef-NodeJHora-Source-Available`) before the first public
   release.

## More Information

- [ADR 0002](0002-clean-room-policy.md): clean-room policy.
- [ADR 0003](0003-pure-typescript-de440s-ephemeris.md): pure-TypeScript
  DE440s reader.
- `packages/ephe/NOTICE.md`, `packages/ephe-long/NOTICE.md`: data provenance
  and citations.
- `packages/ephe-long/FORMAT.md`: the NJCE chunk format.
