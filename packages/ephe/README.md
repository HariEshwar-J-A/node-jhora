# @node-jhora/ephe

JPL DE440s planetary ephemeris data for [node-jhora](https://github.com/HariEshwar-J-A/node-jhora).

This package ships nothing but data and a downloader. All calculation lives in
[`@node-jhora/core`](../core).

## What is in it

`de440s.bsp` — NASA/JPL's DE440 "short" kernel, in NAIF SPK format.

| | |
|---|---|
| **Coverage** | 1849-12-26 to 2150-01-22 |
| **Size** | ~32 MB |
| **Format** | SPK Type 2 (Chebyshev polynomials) |
| **Source** | https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de440s.bsp |
| **Rights** | U.S. Government public domain — no restrictions |

Outside that date range the engine reports an explicit coverage error rather
than extrapolating.

## Why DE440 and not Swiss Ephemeris

Swiss Ephemeris is AGPL-3.0. Any network-facing service built on it — a web API,
a chat bot — must release its entire server-side source under AGPL. JPL's data
carries no such condition, so node-jhora has **no WASM, no Swiss Ephemeris and
no AGPL** anywhere in its dependency graph.

Accuracy is not a trade-off here: the engine sits within **0.28″ of JPL Horizons**
across 1900–2024. See [docs/ACCURACY.md](../../docs/ACCURACY.md).

## Installation

```bash
npm install @node-jhora/ephe
```

The kernel is fetched from JPL by a `postinstall` script rather than being
committed, to keep the package tarball small.

## Resolution order

`@node-jhora/core` looks for the kernel in this order:

1. the `NODE_JHORA_EPHE_PATH` environment variable
2. this package, resolved from `node_modules`
3. a development fallback: `de440s.bsp` beside the `packages/` directory

```bash
export NODE_JHORA_EPHE_PATH=/path/to/de440s.bsp
```

Useful in containers, or to share one kernel between several installations.

## Licence

The DE440 data is a work of the U.S. Government and is in the public domain.
The packaging scripts follow the licence of the parent repository.
