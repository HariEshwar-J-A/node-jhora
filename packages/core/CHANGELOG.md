# @node-jhora/core

## 4.0.0

### Major Changes

- 148c15d: Move `.jhd` support from `@node-jhora/core` to `@node-jhora/format/jhd` (breaking for core: `parseJhd`, `jhdToUtcISO`, `JHD_BODY_ORDER`, `sexagesimalToDecimal`, `hasPositions`, `JhdChart`, `JhdBody` are no longer exported from core). Adds a hardened parser with line-numbered errors, a `.jhd` writer, and Node batch folder import via `@node-jhora/format/node`.

### Minor Changes

- 79b830c: Add the `Body` enum (Rahu = 10, Ketu = 99) and use it across packages. `EphemerisInterpolator.unpack()` now reports node ids 10/99 (was 8/9), matching `getPlanets()`. KP significators keep legacy 7/8.
- 3d83d2b: Add browser and Web Worker builds: `@node-jhora/core/browser`, `@node-jhora/engine/browser` (plus `worker-entry` / `worker-api`), and a browser-safe `@node-jhora/ephe/constants.mjs`. Worker results use a lossless wire format (no float32 quantization) and match Node within 2e-8″ in Chromium, Firefox and WebKit.
- 0431d00: Interpret civil dates before 1582-10-15 as Julian by default (JHora / Swiss Ephemeris), with optional `calendar` setting (`auto` | `gregorian` | `julian`). Birth API routes resolve civil time through the shared resolver so Julian leap days (e.g. 1500-02-29) work.
- 772ab80: Add `resolveCivilTime`: local wall-clock time + IANA zone + place → UTC and Julian Day with a `.njh`-compatible `tzResolution` trace. IANA rules come from the runtime `Intl` tz database; exact longitude LMT before 1900 in India, before 1800 elsewhere and before 1582; DST gap (`forward`/`backward`/`reject`) and fold (`earlier`/`later`/`reject`) policies; manual/war-time overrides. Calendar math reuses the shared `time/historical.ts` implementation.
- b4c9682: Add `deltaTForecast` on calculation settings (`'published' | 'oracle-compat'`, default `'published'`) for the modern ΔT post-bridge path. `'oracle-compat'` preserves the legacy in-house curve used by pyswisseph 2.10 test oracles; `'published'` uses UKHO lod integration and SMH2016 eq. 4.1. Envelope `deltaTModel` ids now name the active forecast.
- 0b65237: Add clean-room tropical house calculators for all documented Swiss Ephemeris house letters (A–Y), including Equal alias `A`, extended ascmc angles (EquAsc, CoAsc1/2, PolAsc), and JHora options (nine-pada equal, SSS, Moon/Sun anchor, cusps-in-middle). W/E/P/O parity unchanged. See ADR 0017.
- 389d0e6: Match JHora's bundled Swiss Ephemeris 2.02.01 DLL to under 1″ on every output (planets, nodes, ayanamsa, ascendant, MC, and Whole/Equal/Placidus/Porphyry cusps) across 1800–2200. Adds `precisionProfile: 'jhora'` (the default). It uses the SE 2.02 ΔT record, the geometric True Chitra ayanamsa, and the DLL's three-step Placidus pole scheme with a Porphyry fallback in polar latitudes. Dates outside DE440s now throw a `RangeError` unless DE431 chunks are attached with `setChunkStore()`. ζ Psc astrometry and the radial velocities of all four stars are re-sourced from Hipparcos (van Leeuwen 2007, I/311) and CRVAD-2 (III/254). Chart, shadbala and KP response values shift by sub-arcsecond amounts.
- aae9e43: Add `precisionProfile: 'modern'`, which follows the sources Swiss Ephemeris 2.10 documents: SMH2016 Table S15 ΔT with the tidal correction before 1955, the observed record through 2026 (USNO), then Stephenson (1997). It also uses the apparent ayanamsa and house frame and fully converged Placidus. Against pyswisseph 2.10.03 on DE431 files, every output is under 1″ in the observed ΔT range, and under 1″ on future dates once the oracle's ΔT is injected. Add `deltaTOverrideSeconds` to pin ΔT; it is included in the settings hash. `'jhora'` stays the default and is unchanged. See docs/precision-profiles.md.
- 3697cf1: npm publish readiness (ADR 0006). Code packages ship only `dist` JS and type declarations, with no source maps, no data and no install scripts, and declare `engines.node >=22` and `{ types, import }` exports. `@node-jhora/core` adds a pinned SHA-256 manifest for DE440s and all 400 DE431 NJCE chunks (`@node-jhora/core` `ephemeris-data` exports), integrity-checking chunk loaders, the `@node-jhora/core/node/ephemeris` resolver (explicit path → installed package → cache → remote, with `NODE_JHORA_CACHE_DIR`, `NODE_JHORA_OFFLINE` and `NODE_JHORA_VERIFY`), and a `node-jhora-ephe` CLI (`where`, `prefetch`, `verify`). `@node-jhora/ephe` drops its `postinstall`, verifies the kernel at `prepack`, and adds type declarations and a provenance `NOTICE.md`; it is now an optional peer of core. `@node-jhora/ephe-long` no longer ships chunk data; the chunks are staged into 40 `@node-jhora/ephe-de431-*` data packages. Ephemeris output is unchanged.
- cd36dbe: Pluggable ephemeris providers: `CompositeEphemerisProvider` routes DE440s (1849–2150, default, unchanged output) and the optional DE431 long-range NJCE chunks (`@node-jhora/ephe-long`, built locally with `pnpm --filter @node-jhora/ephe-long build:chunks`). Adds the `ephemerisPolicy` setting (`auto` | `de440s` | `de431_long`), browser/Node chunk loaders, and proleptic Julian/Gregorian historical date helpers (`julianDayUt`, `civilDateFromJulianDay`). The API birth-date schema accepts astronomical years (year 0 = 1 BC).

### Patch Changes

- 80afc7b: Reject unknown and unsupported Swiss Ephemeris ayanamsa mode numbers instead of silently falling back to True Chitrapaksha. API and settings validation return 4xx for invalid `customAyanamsaMode`.
- f361f1b: Apply IAU 2000 frame bias to chart ecliptic latitude (IERS 2010 eq. (5.32), dα₀ at eq. (5.21)), matching Swiss Ephemeris TRUEPOS oracles; sidereal longitudes stay on the ICRF.
- 7722bb5: CI fixes: Deno-safe chunk-loader imports and resolveConfig prototype-key guard. No calculation output changes.
- 6aadd82: Windows-safe tooling and CodeQL hardening: HTTPS gate before verified ephemeris cache writes (no behaviour change for pinned JPL/jsDelivr URLs).
- 58542a2: Align jhora and modern ΔT with published USNO/IERS tables, Meeus tidal correction, and JHora table-switch JD.
- d7af2ae: Compute planetary daily motions from DE440 Chebyshev velocities through the mean-ecliptic frame instead of a 0.25-day longitude finite difference. True-node speed uses a 1 s symmetric step.
- c1d00ed: Close clean-room geometry gaps for Gauquelin (`G`), Horizontal (`H`), Krusinski (`U`), APC (`Y`), and Sunshine Treindl/Makransky (`I` / `i`) to pyswisseph `houses_armc` parity within the non-polar fixture domain. Export `sunshineMakranskyLongArcWedge` for the documented Makransky long-semi-arc test skip. See ADR 0017.
- 2ad5f40: House geometry parity (pyswisseph `houses_armc`): fix Pullen SD (`L`), Pullen SR (`Q`), Morinus (`M`), and Polich–Page (`T`); map SE sunshine letters `I`/`i` to Treindl/Makransky dispatch per swephprg.htm. Gauquelin, Horizontal, Krusinski, APC, and Sunshine geometry remain documented gaps (ADR 0017).
- fd22685: Placidus `'converged'` scheme: classical fixed-point iteration on right ascension (α = θ + c + g·acos(−tan φ tan ε · sin α)) to 1e-13 rad, with bisection fallback. `'jhora'` pole truncation unchanged (SE 2.02 DLL).
- b2d83b8: Add full-range lunar-node oracle fixture, known-gap ceilings, and era report tools (no engine mean-node change; Meeus eq. 47.7 unchanged).
- 2a88884: Implement Makransky Sunshine (`i`) from published spherical-trigonometry (ADR 0022), polar-latitude house behaviour tests, and document the 89.999999° ascendant pole clamp.
- 2a0debc: Modern precision profile ΔT is built from published SMH2016, USNO/Almanac observations, and Stephenson (1997) extrapolation (ADR 0007). pyswisseph is used only in test fixtures.
- e04c0e8: Add commercial licensing contact to LICENSE section 4, align package metadata and README license sections, and add npm (Changesets + OIDC) and JSR publish pipelines with version sync checks.
- 0d8062c: Add typed `NodeJHoraError` validation, full −10000..+10000 UT span with 402 NJCE chunks (centuries −100..100), geocentric planet speeds when `topocentric=false`, and stricter date/longitude/chunk-preload checks.
- aa42f56: Document daily-motion oracle conventions (ADR 0008): black-box probes show oracles match ~0.001 d tropical FD; engine keeps #281 SPK analytic geometric speeds and 1 s apparent FD. Speed convention golden test; no engine differentiation change.
- e9cf6ad: Refactor true lunar node into a documented osculating-node module (geocentric r×v on the Vondrák mean ecliptic of date). Modern profile uses DE431 kernel for the node outside DE440s when long-range chunks are loaded.
- e5803cb: Harden config merge and ephemeris download host allowlist for CodeQL; CI spawn helpers for Windows.
- 7c499a1: Fix equatorial Vertex (tighter ascendant pole clamp) and Lahiri mode 1 (ICRC 1900 anchor); implement Lahiri ICRC (mode 46) from the CRC true-epoch definition. Drop unsupported SE_SIDM modes that cannot meet published-source parity (De Luce, Yukteshwar, Bhasin, True Revati).
- 72f3bd7: Long-term precession and obliquity from Vondrák et al. (2011) at all epochs; IERS TN36 GMST (eq. 5.32) with Table 5.2e equation-of-origins complementary terms; long-term GMST from Simon et al. (1994) mean Earth longitude and Vondrák precession. Removes duplicate Ω complementary term and the former IAU 2006 precession join window.
- Updated dependencies [3d83d2b]
- Updated dependencies [3697cf1]
- Updated dependencies [e04c0e8]
    - @node-jhora/ephe@440.3.0

## 3.1.0

Release notes before per-package changelogs are recorded in the [repository CHANGELOG](../../CHANGELOG.md).
