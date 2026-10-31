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

| Topic                   | Horizons / oracle                                     | node-jhora (modern + apparent)                                                                               | Expected residual                                                                                                                                                |
| ----------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ephemeris kernel        | DE441 (API label)                                     | DE440s SPK                                                                                                   | Sub-arcsecond for major planets; Moon may reach ~1″ on century boundaries                                                                                        |
| ΔT                      | AA/USNO tabulation + frozen leap-second extrapolation | `modern` profile (SE 2.10-style record through 2026, smooth future model)                                    | Negligible within the published record; grows for **future-dT** epochs (documented loose tolerances)                                                             |
| UT before 1962          | UT1 tags in Horizons output                           | UT input with modern ΔT                                                                                      | Within published-era tolerance                                                                                                                                   |
| Nutation / obliquity    | IAU 2000A via Horizons                                | IAU 2006/2000A engine series                                                                                 | Sub-0.1″ on ecliptic longitude when apparent places are compared                                                                                                 |
| ICRS vs mean J2000      | Horizons apparent uses mean equinox of date chain     | DE440s vectors are ICRF; chart longitudes omit frame bias, latitudes apply IAU 2000 bias (IERS 2010 eq. 5.2) | Uniform ~0.20–0.30″ tropical offset vs Horizons at geocenter when both are converted to the same apparent ecliptic frame; not absorbed into ayanamsa (see below) |
| Aberration / deflection | Included in Horizons apparent (`AIRLESS`)             | `positionMode: 'apparent'`                                                                                   | Must match to sub-arcsecond when ΔT agrees                                                                                                                       |
| Sidereal output frame   | Tropical apparent true equinox                        | Sidereal mean equinox + apparent ayanamsa + Δψ                                                               | Convert before compare; never fit ayanamsa to Horizons                                                                                                           |
| Topocentric parallax    | Horizons `coord@399` + `SITE_COORD`                   | `topocentric: true` with same lat/lon/alt                                                                    | Moon largest; planets negligible except at arcsecond budgets                                                                                                     |
| RA/Dec                  | Horizons quantity `2` (airless apparent)              | Derived from apparent ecliptic via true obliquity                                                            | Informational; ecliptic lon/lat is the enforcement channel                                                                                                       |

Future **future-dT** epochs use the same relaxed caps as `horizons_golden.ts`
(3′ longitude, 1′ latitude): they assert self-consistency, not agreement with
Horizons' frozen ΔT guess.

## Horizons uniform offset (~0.2–0.3″)

Independent comparison at geocenter (`tools/horizons-oracle/`) shows a nearly
constant tropical longitude bias for every major body once both sides use the
same apparent ecliptic reduction. The engine leaves **ecliptic longitude on the
ICRF** while applying the IAU 2000 frame bias only to **ecliptic latitude**
(ADR 0009 / chart TRUEPOS convention). Horizons’ apparent ecliptic longitudes are
referred to the **mean dynamical equinox of J2000.0 after the IERS 2003 frame
bias** before precession–nutation. That ~0.23″ equinox offset is expected from
IERS Technical Note 36 eq. (5.21)–(5.33) and must not be folded into ayanamsa or
ephemeris constants. Topocentric and sidereal comparisons subtract ayanamsa and
compare in the sidereal frame instead.

## Full-range sweep: planets vs angles

**Sidereal graha longitudes** are computed in the **mean** equinox and ecliptic of
date (Vondrák 2011 precession + ε_A; nutation deliberately omitted on the place).
**GAST, ARMC, ascendant, MC, cusps and Vertex** add **nutation in longitude** (and
true obliquity where applicable) on top of the same precession. Replacing IAU 1980
with IAU 2000A nutation therefore moves angle outputs — especially at large |T|
where Δψ differs — but leaves planet longitudes unchanged to numerical precision in
the sweep. The modern profile’s deep-era **shared** planet drift (≈0.5–3.5″ by era)
is not a nutation-series issue; it tracks **mean-frame precession and ΔT** on the
sidereal place chain (see precession brief: oracle equator+ε_A ecliptic vs Fabri
A.3 Table 1 pole for equinox). Fixing that drift requires a precession reformulation
validated against the external kit without regressing JHora/SE goldens.

## Consequences

- Oracle fixtures store Horizons text with provenance; refresh is opt-in live.
- Nightly/local `pnpm horizons-oracle:nightly` may refresh fixtures; CI compare
  stays offline when live fetch is disabled.
- No Swiss Ephemeris or JHora assets are involved; Horizons numbers are oracles
  only (see ADR 0002).
