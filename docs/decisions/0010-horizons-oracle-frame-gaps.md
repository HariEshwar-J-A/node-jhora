# 10. Horizons oracle frame and convention gaps

Date: 2026-10-31

## Status

Accepted

## Context

The independent Horizons oracle (`tools/horizons-oracle/`) compares node-jhora's
**modern** precision profile to JPL Horizons apparent places. Horizons uses DE441
on the API today while the engine integrates **DE440s** from `@node-jhora/ephe`.
The two kernels are siblings, not identical, and the comparison must document
every known convention gap instead of absorbing errors into constants.

## Decision

Report and test with these explicit mismatches left in place:

| Topic                   | Horizons / oracle                                     | node-jhora (modern + apparent)                                            | Expected residual                                                                                    |
| ----------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Ephemeris kernel        | DE441 (API label)                                     | DE440s SPK                                                                | Sub-arcsecond for major planets; Moon may reach ~1″ on century boundaries                            |
| ΔT                      | AA/USNO tabulation + frozen leap-second extrapolation | `modern` profile (SE 2.10-style record through 2026, smooth future model) | Negligible within the published record; grows for **future-dT** epochs (documented loose tolerances) |
| UT before 1962          | UT1 tags in Horizons output                           | UT input with modern ΔT                                                   | Within published-era tolerance                                                                       |
| Nutation / obliquity    | IAU 2000A via Horizons                                | IAU 2006/2000A engine series                                              | Sub-0.1″ on ecliptic longitude when apparent places are compared                                     |
| Aberration / deflection | Included in Horizons apparent (`AIRLESS`)             | `positionMode: 'apparent'`                                                | Must match to sub-arcsecond when ΔT agrees                                                           |
| Sidereal output frame   | Tropical apparent true equinox                        | Sidereal mean equinox + apparent ayanamsa + Δψ                            | Convert before compare; never fit ayanamsa to Horizons                                               |
| Topocentric parallax    | Horizons `coord@399` + `SITE_COORD`                   | `topocentric: true` with same lat/lon/alt                                 | Moon largest; planets negligible except at arcsecond budgets                                         |
| RA/Dec                  | Horizons quantity `2` (airless apparent)              | Derived from apparent ecliptic via true obliquity                         | Informational; ecliptic lon/lat is the enforcement channel                                           |

Future **future-dT** epochs use the same relaxed caps as `horizons_golden.ts`
(3′ longitude, 1′ latitude): they assert self-consistency, not agreement with
Horizons' frozen ΔT guess.

## Consequences

- Oracle fixtures store Horizons text with provenance; refresh is opt-in live.
- Nightly/local `pnpm horizons-oracle:nightly` may refresh fixtures; CI compare
  stays offline when live fetch is disabled.
- No Swiss Ephemeris or JHora assets are involved; Horizons numbers are oracles
  only (see ADR 0002).
