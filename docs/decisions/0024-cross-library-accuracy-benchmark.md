# ADR 0024: Cross-library ephemeris accuracy benchmark

- Status: accepted
- Date: 2026-10-31
- Deciders: maintainers

Technical story: reproducible bench under `bench/accuracy/`

## Context

Maintainers need a reproducible comparison of geocentric **apparent** ecliptic places (tropical true-of-date and Lahiri IAE sidereal) against JPL DE440/DE441 — not marketing claims. The harness stays out of published packages, respects clean-room rules (no Swiss Ephemeris or JHora source reads), and reports both **shared ΔT** and **native ΔT** runs.

## Documented conventions (truth)

| Layer                  | Choice                                                                                                                                                                                                                                                                                                                                                                          | Source                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Ephemeris              | DE440.bsp for 1550–2650 CE (UT JD band in bench); DE441 part-1/part-2 otherwise                                                                                                                                                                                                                                                                                                 | NAIF BSPs (public domain)                                     |
| Time                   | UT epoch + shared Espenak–Meeus ΔT → TT; SPK evaluation via Skyfield timescale                                                                                                                                                                                                                                                                                                  | `lib/deltat.json`, `lib/build_deltat.py`                      |
| TT vs TDB              | TT used for SPK (TDB−TT < 1.7 ms; same as `@node-jhora/core`)                                                                                                                                                                                                                                                                                                                   | IERS Conventions 2010                                         |
| Apparent place         | Light-time iteration, solar deflection, annual aberration (Skyfield `.apparent()`)                                                                                                                                                                                                                                                                                              | Skyfield / ERFA-backed chain                                  |
| Tropical truth         | **True equator and ecliptic of date** — Skyfield `ecliptic_latlon(epoch='date')`                                                                                                                                                                                                                                                                                                | Matches JPL Horizons-style apparent ecliptic                  |
| ERFA gate              | Independent `erfa.pnm06a` + `nut06a` + `obl06` on the same apparent ICRS vector; **must be < 1 mas** on DE440-era probes before tables ship                                                                                                                                                                                                                                     | `truth/validate_conventions.py` → `artifacts/validation.json` |
| Mean node              | Meeus _Astronomical Algorithms_ eq. 47.7 (Chapront-Touzé & Chapront 1991 ELP reduction)                                                                                                                                                                                                                                                                                         | Same coefficients as `mean-lunar-node.ts`                     |
| True node (headline)   | **TN-MED-LT1** — Python only (`truth/true_node_truth.py`): geocentric Moon `(r,v)` from DE (no `.apparent()`); one-shot light-time retardation; ascending node from `h=r×v` in **mean** ecliptic of date (`erfa.ecm06` ≡ `obl06 ∘ rbp` from `bp06`); add **nut06a Δψ once**.                                                                                                    | Independent of `@node-jhora/core`                             |
| True node (alt)        | **TN-MED-INST** — same chain sampled at `jd_ut` (no retardation); truth field `trueNodeInstantDeg` for convention sensitivity only                                                                                                                                                                                                                                              | `true_node_truth.py`                                          |
| True node validation   | **Gate:** `ecm06` vs `obl06∘rbp` on the same ICRS `h` **< 1 mas** (`passedErfaRoutesSubMas`). Skyfield `framelib.ecliptic_frame` is **true** ecliptic of date — expect ~10″ vs **mean** node before Δψ; matches TN-MED apparent (mean + Δψ) to **< 1 mas** (`dSkyfieldTrueEclipticVsApparentTnMedArcsec`). `passed` requires planet ERFA gate + state sanity + ERFA dual route. | `validate_conventions.py` → `artifacts/validation.json`       |
| Engine self-check      | `diagnostics/engine_true_node_self_consistency.mjs` runs production `getPlanets` / `lunar-node.ts` — **not** benchmark truth (would be circular). Residuals vs TN-MED-LT1 report the honest frame/nutation gap (~few arcseconds).                                                                                                                                               | Bench diagnostics only                                        |
| Lahiri IAE (cross-lib) | `tropicalTrue − getAyanamsa(LAHIRI)` (CRC 1955 / Bhatnagar 1990 anchor, modern profile)                                                                                                                                                                                                                                                                                         | `truth/lahiri_cli.mjs` → production `ayanamsa.ts`             |
| node-jhora Lahiri      | Engine sidereal output (`nodeJhoraLahiri` column) reported **separately** — not the cross-library sidereal definition                                                                                                                                                                                                                                                           | ADR 0015                                                      |

## node-jhora comparison frame

Production prints **mean ecliptic of date** longitudes with apparent places for planets when `precisionProfile` is `'jhora'` or `'modern'`. The optional **`'truth'`** profile (ADR 0027) emits **true equinox / mean ecliptic** longitudes (mean + IAU 2000A Δψ). Truth is **not** included in the ADR 0024 ranking columns below unless explicitly added in a future bench revision.

**True node:** node-jhora uses Vondrák 2011 mean ecliptic + engine `nutation()` on the osculating node; truth uses ERFA IAU 2006 mean ecliptic + `nut06a`. Do **not** tune either side; report residuals per era under shared ΔT.

## Libraries

| Library              | Notes                                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `@node-jhora/core`   | DE440s/DE441 composite; apparent mode; modern ΔT                                                                                          |
| **pyswisseph**       | Black-box pip only (`--only-binary` preferred); no source reads. Adapter uses `FLG_JPLEPH` only (flag value 4 / Moshier must not be set). |
| **Skyfield**         | Second pass; should match truth at ~0″                                                                                                    |
| **astronomy-engine** | MIT npm; adapter constructs `AstroTime.fromTerrestrialTime(jdUt)` (TT Julian date, not days since J2000).                                 |
| **astronomia**       | MIT VSOP87 / lunar (short-span analytic)                                                                                                  |

Hosted chart APIs: not wired (no stable key-free endpoint).

## Outputs

- `bench/accuracy/REPORT.md` — max / RMS / p99 per body × era × library × frame (`tropicalTrue`, `lahiriIae`); explicit TrueNode table vs TN-MED-LT1
- `bench/accuracy/artifacts/results.json` — `notBestTropicalTrue` and `notBestLahiriIae` for **shared ΔT** (Skyfield omitted from ranking). Native run keeps summary tables only (ΔT-model stress test).

## References

- JPL NAIF DE440 / DE441 — https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/
- Skyfield — https://rhodesmill.org/skyfield/ (MIT)
- ERFA / IERS Conventions 2010 (BSD)
- Espenak & Meeus ΔT — NASA eclipse canon
- Chapront-Touzé & Chapront (1991); Meeus (1998) eq. 47.7
- ADR 0011, ADR 0015
