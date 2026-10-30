# 8. Daily motion (speed) oracle conventions

Date: 2026-10-26

## Status

Accepted

## Context

Longitude **speed** (degrees per day, negative when retrograde) must match each
precision profile's black-box oracle within 0.01″/day where the ephemeris and
ΔT models already agree. Swiss Ephemeris and JHora source are not available;
conventions are inferred from oracle outputs (`oracle_jhora.json`,
`oracle_modern.json` in the full-range kit), pyswisseph return values when
available, and internal consistency probes (`tools/probe-speed-oracle.mjs`).

Before #281, the engine used a **0.25-day central difference** on tropical
mean-ecliptic longitude. That step is far too coarse for the Moon (~5.7″/day
high vs SE 2.02 / pyswisseph 2.10) and left Mercury ~1.5″/day high.

## Decision

### Shared geometry

- **Frame:** mean ecliptic and equinox of date (no nutation in the place).
- **Default chart mode:** `positionMode: 'geometric'` (JHora TRUEPOS /
  `SEFLG_TRUEPOS`): no light-time, deflection, or aberration in the place chain.
- **Time:** UT Julian day; ephemeris time `ET = (JD_UT + ΔT/86400 − 2451545) × 86400`
  with the profile's ΔT model (and optional `deltaTOverrideSeconds`).

### How the oracles obtain speed (black-box)

Both oracles expose speed as the **fourth component** of `swe_calc_ut` /
equivalent (deg/day in the same sidereal ecliptic frame as longitude). Black-box
stream SP-B1 (JHora DLL 1600 / 2000 / 2026; modern agrees):

| Model                                                           | Matches oracle?                                                  | Interpretation                                                                              |
| --------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Symmetric FD on **tropical** TRUEPOS longitude, **h = 0.001 d** | **Yes** (`jhora` Sun–Saturn ≤0.002″/day)                         | Oracle speed = d(tropical)/dt at this step (equivalent to SPK derivative below 0.001″/day). |
| FD on **reported sidereal** longitude                           | **No** (`jhora`: oracle − sidereal FD ≈ +0.138″/day, all bodies) | Speed omits d(ayan)/dt; offset is geometric True-Citra ayanamsa rate (U1 resolved).         |
| **Moon:** SPK velocity through geometric frame                  | **Yes** (≤~0.02″/day; SP-B2)                                     | No FD step fits Moon; analytic derivative before LT/aberration (TRUEPOS).                   |

True and mean nodes: oracle tropical FD at **0.001 d** matches reported node speed;
the engine uses **mean node** constant regression rate and **true node** 1 s FD
(same as #281), within oracle tolerance in the DE440s window.

### Profile-specific sidereal speed

Displayed longitude is always **sidereal** (`tropical − ayanamsa`). Speed
follows two different rules:

| Profile      | Speed rule                                                                             | Black-box evidence                                                         |
| ------------ | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| **`jhora`**  | Tropical rate at 0.001 d FD (or SPK derivative); **no** `d(ayan)/dt` term.             | Oracle − sidereal FD ≈ +0.138″/day (O3); J−M Sun gap equals ayanamsa rate. |
| **`modern`** | Tropical rate **minus** `d(ayan)/dt` (geometric True Citra; 0.001 d step on ayanamsa). | Matches sidereal FD at 0.001 d to ≤0.01″/day (case 48).                    |

The same `ayanRateForSiderealSpeed` adjustment applies to **Rahu, Ketu, and mean
node** speeds in the `modern` profile only.

### Apparent places

When `positionMode: 'apparent'`, the engine uses a **1 s** symmetric step on the
apparent longitude series (`APPARENT_SPEED_STEP_DAYS`). Oracle black-box FD at
0.001 d is equivalent within ≤0.01″/day at chart epochs.

### Implementation (engine, #281 + ADR 0008)

- **Geometric TRUEPOS:** `meanEclipticDailyMotion` — DE Chebyshev velocity through
  mean ecliptic of date (precession spin + spherical Jacobian); all bodies including
  Moon. Matches oracle SP-B1 to ≤~0.002″/day without a 0.001 d FD step.
- **Apparent:** central difference at `APPARENT_SPEED_STEP_DAYS = 1/86400`.
- **`ephemeris.ts`** — `modern` profile subtracts `d(ayan)/dt` (1 s step on
  geometric True Citra); `jhora` exposes tropical rate.
- **`PLANET_SPEED_STEP_DAYS` (0.25 d)** in `validation/bounds.ts` — DE431 prefetch
  margin only (not used for displayed speed).
- Probes: `tools/probe-speed-step.mjs`, `tools/probe-speed-oracle.mjs` (oracle FD
  step 0.001 d documented here, not wired into the engine).

## Consequences

- Golden tests: `speed-oracle.golden.test.ts` (case 48, ≤0.01″/day),
  `speed-apparent.golden.test.ts`, `speed-conventions.golden.test.ts`.
- Full-range residuals (nj-fullrange-oracle-kit) when not at 0.01″/day are
  dominated by **Moon**, then outer planets, in eras where:
    - the engine uses **DE440s** while the oracle uses **DE431** `.se1` (overlap
      1849–2150, typically 0.02–0.05″/day), or
    - **ΔT** or deep-time ephemeris differ between profiles (0.1–2″/day pre-1000 CE
      and post-5000 CE without oracle ΔT injection).
- Closing the DE440s/DE431 overlap gap for `modern` requires a deliberate
  ephemeris-policy change (positions and speeds), not a differentiation tweak
  alone.

## References

- Capitaine, Wallace & Chapront (2003); Vondrák, Capitaine & Wallace (2011) —
  precession spin term in `meanEclipticRelativeKinematics`.
- JPL DE440s / DE431 kernels (U.S. Government public domain).
- Black-box probes: `tools/probe-speed-oracle.mjs`, `tools/speed-sweep.mjs`.
