# @node-jhora/ephe

JPL DE440s planetary ephemeris data for [node-jhora](https://github.com/HariEshwar-J-A/node-jhora).

This package ships nothing but data. All calculation lives in
[`@node-jhora/core`](../core).

## What is in it

`de440s.bsp` — NASA/JPL's DE440 "short" kernel, in NAIF SPK format.

|              |                                                         |
| ------------ | ------------------------------------------------------- |
| **Coverage** | 1849-12-26 to 2150-01-22                                |
| **Size**     | ~32 MB                                                  |
| **Format**   | SPK Type 2 (Chebyshev polynomials)                      |
| **Source**   | https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de440s.bsp |
| **Rights**   | U.S. Government public domain — no restrictions         |

Outside that date range the engine reports an explicit coverage error rather
than extrapolating.

## Why DE440 and not Swiss Ephemeris

Swiss Ephemeris is AGPL-3.0. Any network-facing service built on it — a web API,
a chat bot — must release its entire server-side source under AGPL. JPL's data
carries no such condition, so node-jhora has **no WASM, no Swiss Ephemeris and
no AGPL** anywhere in its dependency graph.

Accuracy is not a trade-off here: the engine sits within **0.28″ of JPL Horizons**
across 1900–2024. See [docs/accuracy.md](../../docs/accuracy.md).

## Installation

```bash
npm install @node-jhora/ephe
```

The kernel is **inside the package tarball** (about 31 MB packed). There is
no `postinstall` script: npm v12 and pnpm do not run dependency lifecycle
scripts by default, and an install that needs no network is reproducible and
works offline. When the package is packed, `prepack` runs `download.mjs`,
which fetches the file from JPL if it is missing and refuses any copy whose
size or SHA-256 differs from the pinned values in [NOTICE.md](./NOTICE.md).
In this monorepo the root `postinstall` runs the same script so the kernel is
present for development.

This package is optional. Without it, `@node-jhora/core` downloads the same
bytes from JPL into a user cache on first use, verifies the SHA-256, and
reuses the cached copy afterwards. Use `npx node-jhora-ephe prefetch de440s`
to fill the cache ahead of time, or `NODE_JHORA_OFFLINE=1` to forbid network
access. See ADR [0006](../../docs/decisions/0006-npm-packaging-and-ephemeris-data-distribution.md).

## Resolution order

`@node-jhora/core` looks for the kernel in this order:

1. the `NODE_JHORA_EPHE_PATH` environment variable
2. this package, resolved from `node_modules`
3. the user cache (`NODE_JHORA_CACHE_DIR`, else `$XDG_CACHE_HOME/node-jhora`,
   `~/Library/Caches/node-jhora`, `%LOCALAPPDATA%\node-jhora\Cache` or
   `~/.cache/node-jhora`)
4. a download from JPL into that cache, checked against the pinned SHA-256
   (skipped when `NODE_JHORA_OFFLINE=1`)

```bash
export NODE_JHORA_EPHE_PATH=/path/to/de440s.bsp
```

Useful in containers, or to share one kernel between several installations.

Browsers cannot fetch from JPL (its servers send no CORS headers). Serve the
file yourself, or use the copy jsDelivr mirrors from this package:
`https://cdn.jsdelivr.net/npm/@node-jhora/ephe@440.2.0/de440s.bsp`.

## Licence

The DE440 data is published by NASA/JPL; see [NOTICE.md](./NOTICE.md) for
provenance and citation. The packaging scripts follow the licence of the
parent repository.
