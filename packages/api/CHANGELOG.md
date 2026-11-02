# @node-jhora/api

## 3.1.1

### Patch Changes

- 80afc7b: Reject unknown and unsupported Swiss Ephemeris ayanamsa mode numbers instead of silently falling back to True Chitrapaksha. API and settings validation return 4xx for invalid `customAyanamsaMode`.
- 79b830c: Add the `Body` enum (Rahu = 10, Ketu = 99) and use it across packages. `EphemerisInterpolator.unpack()` now reports node ids 10/99 (was 8/9), matching `getPlanets()`. KP significators keep legacy 7/8.
- 0431d00: Interpret civil dates before 1582-10-15 as Julian by default (JHora / Swiss Ephemeris), with optional `calendar` setting (`auto` | `gregorian` | `julian`). Birth API routes resolve civil time through the shared resolver so Julian leap days (e.g. 1500-02-29) work.
- 0b65237: Add clean-room tropical house calculators for all documented Swiss Ephemeris house letters (A–Y), including Equal alias `A`, extended ascmc angles (EquAsc, CoAsc1/2, PolAsc), and JHora options (nine-pada equal, SSS, Moon/Sun anchor, cusps-in-middle). W/E/P/O parity unchanged. See ADR 0017.
- 389d0e6: Match JHora's bundled Swiss Ephemeris 2.02.01 DLL to under 1″ on every output (planets, nodes, ayanamsa, ascendant, MC, and Whole/Equal/Placidus/Porphyry cusps) across 1800–2200. Adds `precisionProfile: 'jhora'` (the default). It uses the SE 2.02 ΔT record, the geometric True Chitra ayanamsa, and the DLL's three-step Placidus pole scheme with a Porphyry fallback in polar latitudes. Dates outside DE440s now throw a `RangeError` unless DE431 chunks are attached with `setChunkStore()`. ζ Psc astrometry and the radial velocities of all four stars are re-sourced from Hipparcos (van Leeuwen 2007, I/311) and CRVAD-2 (III/254). Chart, shadbala and KP response values shift by sub-arcsecond amounts.
- 3697cf1: npm publish readiness (ADR 0006). Code packages ship only `dist` JS and type declarations, with no source maps, no data and no install scripts, and declare `engines.node >=22` and `{ types, import }` exports. `@node-jhora/core` adds a pinned SHA-256 manifest for DE440s and all 400 DE431 NJCE chunks (`@node-jhora/core` `ephemeris-data` exports), integrity-checking chunk loaders, the `@node-jhora/core/node/ephemeris` resolver (explicit path → installed package → cache → remote, with `NODE_JHORA_CACHE_DIR`, `NODE_JHORA_OFFLINE` and `NODE_JHORA_VERIFY`), and a `node-jhora-ephe` CLI (`where`, `prefetch`, `verify`). `@node-jhora/ephe` drops its `postinstall`, verifies the kernel at `prepack`, and adds type declarations and a provenance `NOTICE.md`; it is now an optional peer of core. `@node-jhora/ephe-long` no longer ships chunk data; the chunks are staged into 40 `@node-jhora/ephe-de431-*` data packages. Ephemeris output is unchanged.
- cd36dbe: Pluggable ephemeris providers: `CompositeEphemerisProvider` routes DE440s (1849–2150, default, unchanged output) and the optional DE431 long-range NJCE chunks (`@node-jhora/ephe-long`, built locally with `pnpm --filter @node-jhora/ephe-long build:chunks`). Adds the `ephemerisPolicy` setting (`auto` | `de440s` | `de431_long`), browser/Node chunk loaders, and proleptic Julian/Gregorian historical date helpers (`julianDayUt`, `civilDateFromJulianDay`). The API birth-date schema accepts astronomical years (year 0 = 1 BC).
- e04c0e8: Add commercial licensing contact to LICENSE section 4, align package metadata and README license sections, and add npm (Changesets + OIDC) and JSR publish pipelines with version sync checks.
- 72f3bd7: Long-term precession and obliquity from Vondrák et al. (2011) at all epochs; IERS TN36 GMST (eq. 5.32) with Table 5.2e equation-of-origins complementary terms; long-term GMST from Simon et al. (1994) mean Earth longitude and Vondrák precession. Removes duplicate Ω complementary term and the former IAU 2006 precession join window.
- Updated dependencies [80afc7b]
- Updated dependencies [79b830c]
- Updated dependencies [3d83d2b]
- Updated dependencies [0431d00]
- Updated dependencies [f361f1b]
- Updated dependencies [7722bb5]
- Updated dependencies [6aadd82]
- Updated dependencies [772ab80]
- Updated dependencies [b4c9682]
- Updated dependencies [58542a2]
- Updated dependencies [d7af2ae]
- Updated dependencies [0b65237]
- Updated dependencies [c1d00ed]
- Updated dependencies [2ad5f40]
- Updated dependencies [fd22685]
- Updated dependencies [148c15d]
- Updated dependencies [389d0e6]
- Updated dependencies [b2d83b8]
- Updated dependencies [2a88884]
- Updated dependencies [2a0debc]
- Updated dependencies [aae9e43]
- Updated dependencies [3697cf1]
- Updated dependencies [cd36dbe]
- Updated dependencies [e04c0e8]
- Updated dependencies [0d8062c]
- Updated dependencies [aa42f56]
- Updated dependencies [e9cf6ad]
- Updated dependencies [e5803cb]
- Updated dependencies [7c499a1]
- Updated dependencies [72f3bd7]
    - @node-jhora/core@4.0.0
    - @node-jhora/analytics@3.1.1
    - @node-jhora/engine@3.2.0
    - @node-jhora/match@3.1.1
    - @node-jhora/prediction@3.1.1

## 3.1.0

Release notes before per-package changelogs are recorded in the [repository CHANGELOG](../../CHANGELOG.md).
