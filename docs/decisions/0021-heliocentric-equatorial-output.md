# 0021. Heliocentric and equatorial planet output options

Date: 2026-10-31

## Status

Accepted

## Context

Coverage audit (2026-10-31) listed missing Swiss Ephemeris-style output flags for
heliocentric positions and equatorial (RA/Dec) coordinates. Defaults must remain
geocentric sidereal ecliptic for JHora parity.

## Decision

Extend `EphemerisEngine.getPlanets` options (no breaking change):

| Option              | Values                       | Default      | Meaning                                                                                                            |
| ------------------- | ---------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------ |
| `observationCenter` | `geocentric`, `heliocentric` | `geocentric` | Heliocentric uses Sun-centered J2000 vectors (body − Sun), geometric place on the mean ecliptic of date            |
| `coordinateOutput`  | `ecliptic`, `equatorial`     | `ecliptic`   | When `equatorial`, populate `PlanetPosition.rightAscension` alongside existing ecliptic long/lat and `declination` |

Heliocentric positions use the same DE440 barycentric states as geocentric places; no
Swiss Ephemeris code. Lunar nodes remain **geocentric** in heliocentric mode (observation
points, not mass centers).

RA/Dec uses mean obliquity ε_A (Vondrák 2011) on the mean ecliptic of date — consistent
with existing `declination` on ecliptic longitudes.

## Consequences

- `PlanetPosition` gains optional `rightAscension`.
- Existing callers unchanged when options are omitted.
- Heliocentric topocentric combinations are not supported (location ignored except geocentric).

## References

- NASA JPL NAIF SPK conventions (heliocentric rectangular vectors)
- Meeus, _Astronomical Algorithms_, ecliptic ↔ equatorial transformation
- Swiss Ephemeris general documentation (output flag semantics, prose only)
