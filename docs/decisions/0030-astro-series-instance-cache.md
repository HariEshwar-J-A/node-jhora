# ADR 0030: Instance astro-series memo and deep-era Vondrák Lagrange table

## Status

Accepted (server-grade PR4)

## Context

Truth-profile `getPlanets` evaluates `nutationIau2000a` at three Julian centuries per body
(central-difference speeds). Jhora houses and truth ayanamsa repeat the same nutation series at
identical `T`. Vondrák precession and mean obliquity dominate jhora/modern planet cost outside
the truth IAU 2006 mean-ecliptic window.

Deep-era truth mean node (DE441 secular path, ADR 0029) samples Ω at ~93k TT instants over
±250 Julian years. Each sample applied exact Vondrák `eraLtecm` (~1.7 s cold).

## Decision

1. **Instance FIFO Map** on `EphemerisEngine` (`AstroSeriesCache`, cap 64), keyed by series id
   and exact Julian century `T`. Active only under `withAstroSeriesCache` during
   `getPlanets`, `getHouses`, and `getAyanamsa`. Series:
    - `nutation-iau2000a` → `{ dpsi, deps }`
    - `vondrak-mean-obliquity` → degrees
    - `vondrak-precession-matrix` → 3×3 matrix

2. **Deep-era ltecm**: one shared 32-day node table per secular anchor JD; per-sample rotation
   uses **4-point Lagrange** on each matrix element (not two-node Hermite, which reached
   ~13″ error on Ω). Table build still uses exact `vondrakLtecmMatrixInto` at nodes only.

## Consequences

- No module-global memo (contrast `setIersEopTable`).
- Truth deep-era mean node may differ from the pre-PR4 exact matrix path by ≤ 1e-6″ (tested per
  committed `de441MeanNode` epochs).
- Hermite 32-day interpolation remains in `vondrak-ltecm-interp.ts` for regression documentation
  only.

## References

- Server-grade plan §7 PR4; IERS Conventions (2010) nut06a; Vondrák et al. (2011); ERFA BSD
  (`eraLtecm`, `nut00a`).
