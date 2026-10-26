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

## Runtime

Load chunks through `@node-jhora/core` (`De431ChunkStore` + `fetchChunkLoader` in the browser, or a filesystem loader in Node). The engine selects DE440s inside 1849–2150 and DE431 chunks outside that span when `ephemerisPolicy` is `auto`.
