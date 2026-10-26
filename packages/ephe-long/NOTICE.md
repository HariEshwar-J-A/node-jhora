# Data provenance — @node-jhora/ephe-long

This package contains tools only. The chunk data it produces ships in
separate data packages (`@node-jhora/ephe-de431-*`), one per 500 years; see
ADR [0006](../../docs/decisions/0006-npm-packaging-and-ephemeris-data-distribution.md).

|               |                                                                                                                                      |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Dataset**   | JPL Planetary and Lunar Ephemeris DE431 (time-span kernel)                                                                           |
| **File**      | `de431t.bsp`, 3,696,366,592 bytes                                                                                                    |
| **Source**    | https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de431t.bsp                                                                              |
| **Transform** | Type 2 Chebyshev coefficients copied verbatim into NJCE chunks (`scripts/build-chunks.mjs`, [FORMAT.md](./FORMAT.md)); no resampling |
| **Integrity** | SHA-256 of each of the 400 chunks is pinned in `@node-jhora/core` (`src/ephemeris-data/manifest.generated.ts`)                       |

Citation: W. M. Folkner, J. G. Williams, D. H. Boggs, R. S. Park, P. Kuchynka,
"The Planetary and Lunar Ephemerides DE430 and DE431",
IPN Progress Report 42-196 (2014).
