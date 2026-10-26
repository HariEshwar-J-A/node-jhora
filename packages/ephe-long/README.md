# @node-jhora/ephe-long

Optional long-range ephemeris data derived from **JPL DE431** (U.S. Government public domain). The raw 3.4 GB `de431t.bsp` kernel (JPL publishes DE431 as `de431t.bsp`; there is no `de431.bsp`) is **never** committed; `scripts/build-chunks.mjs` downloads it from NASA and writes compact `.njce` chunk files.

## Coverage

- **10000 BCE – 10000 CE** (astronomical year numbering, proleptic Julian before 1582-10-15)
- Bodies: Sun through Pluto, Moon, Earth, Earth–Moon barycentre
- Fidelity: Chebyshev coefficients are copied from DE431 Type-2 segments (no Swiss Ephemeris files or code)

## Chunk layout

- **One file per Julian century per body group** (`g0` = Sun–Pluto vs SSB, `g1` = EMB / Moon / Earth)
- Filename pattern: `g{group}-c{century}.njce` (e.g. `g0-c19.njce` for the 1900s)
- Binary format: see [FORMAT.md](./FORMAT.md)

## Build

```bash
# Requires a 3.4 GB download once (https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de431t.bsp);
# output under packages/ephe-long/dist/. Not part of `pnpm -r build` (that is a no-op here).
pnpm --filter @node-jhora/ephe-long run build:chunks
```

Environment:

- `DE431_BSP_PATH` — use an existing `de431t.bsp` instead of downloading (size is verified)
- `NJCE_OUT_DIR` — output directory (default: `packages/ephe-long/dist`)
- `NJCE_CENTURIES` — century range `min:max` (default `-100:99`, i.e. -9999..9999 with the century containing it)

## Size (measured after build)

Measured on 2026-10-26 from `de431t.bsp` (3,696,366,592 bytes), default range:

|                            | files   | total         | per century  |
| -------------------------- | ------- | ------------- | ------------ |
| `g0` Sun–Pluto barycentres | 200     | 830.4 MB      | 4.15 MB      |
| `g1` EMB, Moon, Earth      | 200     | 1348.3 MB     | 6.74 MB      |
| **all**                    | **400** | **2178.7 MB** | **10.89 MB** |

Coefficients are float64 copied verbatim, so the set is large; browser deployments should fetch only the centuries they need. Most of `g1` is Earth (399) relative to EMB, which could later be derived from the Moon segment and the DE431 Earth/Moon mass ratio instead of being stored.

## Distribution

The chunks are too large for one npm package (2.18 GB; npm rejects tarballs
well under that). They are split into **40 data packages of 500 years each**,
`@node-jhora/ephe-de431-{p|m}{start year}` (for example
`@node-jhora/ephe-de431-p1500` for 1500–1999 and `@node-jhora/ephe-de431-m3000`
for -3000..-2501), about 54 MB unpacked each. This package itself ships no data.

```bash
# after build:chunks: pin the hashes in @node-jhora/core, then stage the data packages
pnpm --filter @node-jhora/ephe-long run generate:manifest            # writes core/src/ephemeris-data/manifest.generated.ts
pnpm --filter @node-jhora/core build
pnpm --filter @node-jhora/ephe-long run stage:data -- --pack-dry-run # .release/ephe-de431/*, npm pack --dry-run only
```

The staging script refuses any chunk whose SHA-256 differs from the manifest.
It never publishes; the publish setup is described in ADR
[0006](../../docs/decisions/0006-npm-packaging-and-ephemeris-data-distribution.md).

## Runtime

In Node, `registerNodeChunkStore(engine, options)` from
`@node-jhora/core/node/ephemeris` looks for each chunk in
`NODE_JHORA_EPHE_LONG_DIR` (or `options.dirs`), then an installed data package,
then the user cache, then a remote you choose (`baseUrl` for a self-hosted
copy, `urlFor`, or `cdn: true` for jsDelivr's copy of the data packages).
Every chunk is checked against the SHA-256 manifest wherever it came from.
`npx node-jhora-ephe prefetch de431 --from 1500 --to 2200 --base-url URL`
fills the cache for offline use.

In the browser, use `De431ChunkStore` with `verifyingChunkLoader(fetchChunkLoader(baseUrl))`.
The engine selects DE440s inside 1849–2150 and DE431 chunks outside that span when `ephemerisPolicy` is `auto`.
