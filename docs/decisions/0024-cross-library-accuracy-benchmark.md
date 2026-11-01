# ADR 0024: Cross-library ephemeris accuracy benchmark

- Status: accepted
- Date: 2026-10-31
- Deciders: maintainers

Technical story: reproducible bench under `bench/accuracy/`

## Context

Maintainers need a reproducible comparison of geocentric **apparent** ecliptic places (tropical true-of-date and Lahiri IAE sidereal) against JPL DE440/DE441 — not marketing claims. The harness stays out of published packages, respects clean-room rules (no Swiss Ephemeris or JHora source reads), and reports both **shared ΔT** and **native ΔT** runs.

## Documented conventions (truth)

| Layer                  | Choice                                                                                                                                                                                                                            | Source                                                        |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Ephemeris              | DE440.bsp for 1550–2650 CE (UT JD band in bench); DE441 part-1/part-2 otherwise                                                                                                                                                   | NAIF BSPs (public domain)                                     |
| Time                   | UT epoch + shared Espenak–Meeus ΔT → TT; SPK in **TDB** (ERFA `dtdb`); two-part Julian dates for light-time                                                                                                                       | `lib/deltat.json`, `truth/truth_profile_erfa.py`              |
| Apparent place         | Light-time iteration, solar deflection, annual aberration (Skyfield `.apparent()`)                                                                                                                                                | Skyfield / ERFA-backed chain                                  |
| Tropical truth         | **Mean ecliptic of date** (`erfa.ecm06`) with **nut06a Δψ on λ only**; latitude on mean ecliptic — same as `truth_profile_erfa.json` / ADR 0027                                                                                   | `truth/truth_profile_erfa.py`, `compute_truth.py`             |
| ERFA gate              | Repeatability of truth-profile chart frame **< 1 mas** on DE440-era probes; logs bias vs Skyfield true ecliptic (~0.02″ frame route)                                                                                              | `truth/validate_conventions.py` → `artifacts/validation.json` |
| Mean node              | ERFA `faom03` (IAU 2006)                                                                                                                                                                                                          | `truth_profile_erfa.py`                                       |
| True node (headline)   | Geocentric Moon with one-shot light-time retardation (two-part TDB); ascending node in mean ecliptic (`ecm06`) + **nut06a Δψ once** — same as truth golden fixture                                                                | `truth_profile_erfa.py`                                       |
| Skyfield competitor    | Separate adapter column: apparent **true** ecliptic of date (`epoch='date'`) — **not** benchmark truth                                                                                                                            | `compute_skyfield_competitor_epoch`                           |
| Engine self-check      | `diagnostics/engine_true_node_self_consistency.mjs` runs production `getPlanets` / `lunar-node.ts` — **not** benchmark truth (would be circular). Residuals vs TN-MED-LT1 report the honest frame/nutation gap (~few arcseconds). | Bench diagnostics only                                        |
| Lahiri IAE (cross-lib) | `tropicalTrue − getAyanamsa(LAHIRI)` (CRC 1955 / Bhatnagar 1990 anchor, modern profile)                                                                                                                                           | `truth/lahiri_cli.mjs` → production `ayanamsa.ts`             |
| node-jhora Lahiri      | Engine sidereal output (`nodeJhoraLahiri` column) reported **separately** — not the cross-library sidereal definition                                                                                                             | ADR 0015                                                      |

## node-jhora comparison frame

Production prints **mean ecliptic of date** longitudes with apparent places for planets when `precisionProfile` is `'jhora'` or `'modern'`. The **`'truth'`** profile (ADR 0027) matches benchmark truth (mean ecliptic + nut06a Δψ on λ). The bench reports **`node-jhora-truth`** on shared ΔT (headline gate ≤ 0.0001″ in 1850–2150) and **`node-jhora`** (modern profile) separately.

**True node:** node-jhora uses Vondrák 2011 mean ecliptic + engine `nutation()` on the osculating node; truth uses ERFA IAU 2006 mean ecliptic + `nut06a`. Do **not** tune either side; report residuals per era under shared ΔT.

## Libraries

| Library              | Notes                                                                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `@node-jhora/core`   | DE440s/DE441 composite; apparent mode; modern ΔT                                                                                          |
| **pyswisseph**       | Black-box pip only (`--only-binary` preferred); no source reads. Adapter uses `FLG_JPLEPH` only (flag value 4 / Moshier must not be set). |
| **Skyfield**         | Competitor column only (true ecliptic of date); ~0.02″ vs benchmark truth by frame definition                                             |
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
