# ADR 0012: Mean lunar node outside 0–2150 CE

- Status: accepted (no engine change at this time)
- Date: 2026-10-31
- Deciders: maintainers

## Context

The engine exposes the mean ascending node (Rahu) via Meeus, _Astronomical Algorithms_
eq. 47.7 (`meanLunarNode` in `ayanamsa.ts`). Against the clean-room lunar-node oracle
(JHora and pyswisseph exports in `lunar-node-oracle.json`), residuals stay under ~0.5″
for sidereal years **0..2150** but grow to arcminutes and **~953″** near year −10000.

Both oracles agree with each other. Their mean node matches an ELP2000-family polynomial
plus a **long-term correction**: century-step tabulated values with linear
interpolation, derived from JPL lunar ephemeris comparisons—not from Simon et al.
(1994) or Chapront et al. (2002) polynomials alone. Swiss Ephemeris programmer
documentation describes that century-step correction; importing third-party fitted
correction tables would contaminate the clean-room policy (GPL-adjacent fitted data).

## Investigation (allowed approaches)

### 1. Simon / ELP2000-82B W3 + Vondrák precession

W3 constants from Simon et al. (1994) / ELP2000-82B, referred to the mean ecliptic of
date via `icrfToMeanEclipticOfDate` (Vondrák et al. 2011), improve agreement near J2000
(~0.01″ vs oracle at year 2000) but **regress** the 0..2150 gate (max **~3.5″** vs
~0.5″ for Meeus) and still leave **~467″** at −10000. MPP02/DE406 secular adjustments
from the published ELP/MPP02 papers do not close the deep-time gap and worsen the
0..2150 window (~41″ max in probes).

Maintainer probe: `node tools/mean-node-model-probe.mjs`.

### 2. Independent DE441 derivation

Using NAIF `de441_part-1.bsp` + `de441_part-2.bsp` (public domain), we computed a numeric
mean at each epoch by **unwrapping** true-node longitudes over one nodal period
(~6798.383 d) and linear least squares (slope ≈ −0.05295°/day). At J2000 this matches
Meeus to ~0.001″ tropical, confirming the implementation, but sidereal comparison to
the oracle at −10000 / +9999 remains **orders of magnitude worse** than Meeus because
the oracle mean node is **not** the osculating-node average over a draconic cycle (the
mean regresses ~360° over that interval; circular means are invalid).

Script: `tools/derive-mean-node-de441-correction.mjs` (`--quick` for spot checks).

## Decision

**Do not change `meanLunarNode` or ephemeris node speed** until we have a clean-room
long-term model that:

1. Keeps the 0..2150 oracle gate (≤ ~0.5″) and zero true-node regressions, and
2. Reaches sub-arcsecond agreement outside that window without importing third-party
   fitted correction tables.

Candidate next step (not implemented here): tabulate corrections at century boundaries
by comparing a **published** analytic mean (Simon W3 + Vondrák referral) to a DE441
reference mean using a construction aligned with what Swiss Ephemeris programmer
documentation describes (analytic ELP mean adjusted using lunar state from JPL
ephemeris—without importing third-party coefficients), then linearly interpolate—with
JPL primary data only.

## Measured era maxima (arcsec, |Δ| sidereal mean vs JHora oracle)

Engine unchanged (Meeus eq. 47.7). From `node tools/mean-node-era-report.mjs` after build:

| Era           | J / Jo | M / Mo |
| ------------- | -----: | -----: |
| −10000..−5000 | 953.13 | 930.21 |
| −5000..−3000  |  13.77 |  12.77 |
| −3000..−1000  |  10.63 |  14.25 |
| −1000..0      |   5.99 |   6.92 |
| 0..1000       |   0.50 |   0.26 |
| 1000..1582    |   0.26 |   0.25 |
| 1582..1850    |   0.24 |   0.20 |
| 1850..2026    |   0.15 |   0.10 |
| 2026..2150    |   0.17 |   0.32 |
| 2150..3000    |   2.28 |   0.58 |
| 3000..5000    |   4.18 |   3.35 |
| 5000..10000   |  81.79 |  82.35 |

After (engine): **identical** — no change merged.

## Consequences

- Good: Avoids licensing contamination and false confidence from a DE441 average that
  does not match the oracle mean-node definition.
- Bad: Known-gap ceilings in `lunar-node-known-gap.test.ts` remain; deep-time charts
  still disagree with the oracles by arcminutes at extreme dates.

## References

- Simon et al. (1994), A&A 282, 663 — ELP2000-82B argument polynomials
- Chapront et al. (2002), A&A 387, 700 — LLR / secular terms
- Park et al. (2021), AJ 161, 105 — DE441
- Swiss Ephemeris programmer documentation §2.2.1 (century-step mean-node correction
  _described_, not copied): https://www.astro.com/swisseph/swisseph.htm
- Repository: `packages/core/tests/fixtures/lunar-node-oracle.json`,
  `tools/mean-node-era-report.mjs`
