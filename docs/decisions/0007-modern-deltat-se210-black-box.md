# ADR 0007: Modern precision profile ΔT from published sources

## Status

Accepted (2026-10-26), revised 2026-10-26 (provenance + clean-room forecast)

## Context

`precisionProfile: 'modern'` must follow the ΔT **layout** described in Swiss Ephemeris
programmer manual ch. 7 (SMH2016 spline, AA/USNO observations, tidal n′ correction, forecast
polynomials), using **peer-reviewed coefficients**, **USNO/IERS observations**, and
**pyswisseph-measured bridge years** where no public prediction matches. Swiss Ephemeris
source code and `swe_deltat()` tables are AGPL and forbidden in `packages/core/src`.

## Decision

Implement `deltaTModern(jdUT)` in `packages/core/src/engine/deltat-modern.ts`:

1. **Y < −720** — SMH2016 Table S15 parabola (eq. 4.1) minus the published join offset at
   −720, plus van Gent tidal correction to DE431 n′.

2. **−720 ≤ Y < 1954** — Table S15 cubic spline + tidal; **no** fitted knot-day overshoot
   (pyswisseph’s −720 CE Julian day is an oracle-only spike; see known-gap tests).

3. **1955 ≤ Y ≤ last USNO month** — AA K8–K9 (Bessel) and USNO `deltat.data` monthly rows.

4. **2027–2028** — Bridge seconds measured from pyswisseph 2.10 (`deltat-modern-bridge.ts`,
   `tools/generate-deltat-modern-bridge.mjs`).

5. **Y > 2028** — UKHO near-term cubic, millennial parabola from 2500 CE, and a **100-year
   linear hand-off** from the last bridge second (`deltat-modern-forecast.ts`).

Envelope id: `modern:smh2016-s15+aa-usno-monthly+oracle-bridge+ukho-cubic+smh2016-parabola`.

## Validation vs pyswisseph 2.10 (measured)

Run `node tools/measure-deltat-modern-residuals.mjs` after `pnpm --filter @node-jhora/core build`.
Latest sweep (yearly −10000…+10000 on mean-Gregorian JD, plus dense almanac-year samples at
joins):

| Band                      | Max \|ΔT\| (s) | Notes                                                   |
| ------------------------- | -------------: | ------------------------------------------------------- |
| Y < 1955 (excl. knot day) |           ≈0.6 | Deep past / spline                                      |
| −720 CE oracle JD         |           ≈450 | SMH2016 only; `known-gap` ceiling test                  |
| Kit bound −719.688…       |          <0.06 | Near knot                                               |
| 1955–2025                 |          ≤0.05 | USNO record + monthly                                   |
| 2026 (USNO vs oracle)     |          ≈0.21 | Oracle uses non-USNO extrapolation; test ceiling 0.25 s |
| 2027–2028 bridge          |          ≤0.33 | Oracle-measured bridge (almanac-year JD grid)           |
| 2029–10000                |         <1e−10 | Forecast + hand-off at almanac-year JDs                 |

Chart goldens (`modern-se210.golden.test.ts`) assert mode **M** within **1″** and ΔT within
**0.06 s** for UTC ≤ 2026; later UTC cases use the bridge + forecast path.

## Consequences

- Regenerate USNO tables with `tools/generate-deltat-monthly.mjs` when `deltat.data` updates.
- Regenerate bridge with `tools/generate-deltat-modern-bridge.mjs` when the test oracle changes.
- `jhora` ΔT is unchanged.
