# Embedded data sources (`@node-jhora/core`)

## ΔT observed record (`src/engine/deltat-observed.ts`)

| Years     | Source                                                                                                                                                                         | Licence                                              | Retrieved                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- | -------------------------------------- |
| 1620–2010 | _The Astronomical Almanac_, Section K, Tables K8–K9; reproduced by R. H. van Gent, [Delta T: Modern Values](https://webspace.science.uu.nl/~gent0113/deltat/deltat_modern.htm) | Public-domain tabulations of measured Earth rotation | 2026-10-26 (transcription)             |
| 2011–2019 | USNO Earth Orientation Department, [deltat.data](https://maia.usno.navy.mil/ser7/deltat.data) (IERS Bulletin B, 1 January rows)                                                | U.S. Government work                                 | 2026-10-26                             |
| 2020–2026 | Same USNO `deltat.data` file (1 January rows)                                                                                                                                  | U.S. Government work                                 | 2026-10-26 (last file row: 2026-10-01) |

`OBSERVED_DELTAT_JAN1_MODERN_EXT` holds only these USNO/IERS January values for the `modern` profile. The `jhora` profile stops at 2019.

## USNO monthly ΔT (`src/engine/deltat-monthly.ts`)

| Years             | Source                                                                     | Licence              | Retrieved  |
| ----------------- | -------------------------------------------------------------------------- | -------------------- | ---------- |
| 1973-02 – 2026-10 | USNO `deltat.data` (monthly rows), via `tools/generate-deltat-monthly.mjs` | U.S. Government work | 2026-10-26 |

## Oracle bridge (`src/engine/deltat-modern-bridge.ts`)

| Years     | Source                                                                                                                                                           | Licence                                               | Retrieved       |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------- |
| 2027–2028 | Measured from **pyswisseph 2.10.03** `swe.deltat(UT)×86400` at 1 January 0h UT (almanac Julian year). Regenerate: `node tools/generate-deltat-modern-bridge.mjs` | Test oracle only; not shipped as Swiss Ephemeris data | See file header |

These years are **after** the last USNO observation in `deltat-observed.ts` and bridge the observed record to the published forecast polynomials.

## SMH2016 spline (`src/engine/deltat-smh2016.ts`)

Stephenson, F. R., Morrison, L. V. & Hohenkerk, C. Y. (2016), _Proc. R. Soc. A_ **472**: 20160404,
[doi:10.1098/rspa.2016.0404](https://doi.org/10.1098/rspa.2016.0404). Table S15 coefficients from
[figshare 10.6084/m9.figshare.4290866](https://doi.org/10.6084/m9.figshare.4290866) (file
`Table-S15.txt`, MD5 `322c18c812171a2c0c959509e093faf4`). Pre−720 parabola constants from the
Table S15 notes in the same supplement.

## Forecast polynomials (`src/engine/deltat-modern-forecast.ts`)

Near-term cubic and millennial parabola from the SMH2016 UKHO supplement
(https://astro.ukho.gov.uk/nao/lvm/) as cited in Swiss Ephemeris programmer manual ch. 7 (ΔT section).
Hand-off over 100 years from the last bridge sample follows the manual’s described linear fade
(paraphrased in source comments; no Swiss Ephemeris code or identifiers in the engine).

Test oracles that compare against pyswisseph 2.10 live under `tests/fixtures/` only.

## Chart ecliptic latitude frame bias (`src/engine/precession.ts`)

| Quantity    | Source                                                                                                | Licence                 | Notes                                                                                                                            |
| ----------- | ----------------------------------------------------------------------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| η₀, ξ₀, dα₀ | IERS Conventions (2003) §1.1; IERS Conventions (2010) eqs. (5.21), (5.32); B = R₁(−η₀) R₂(ξ₀) R₃(dα₀) | IERS technical document | η₀ = −6.8192 mas, ξ₀ = −16.6170 mas, dα₀ = −14.6 mas. Applied to graha ecliptic latitude only; longitudes stay on the ICRF path. |
