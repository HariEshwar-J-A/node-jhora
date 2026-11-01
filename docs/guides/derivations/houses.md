# House cusps: Regiomontanus, Campanus, Koch

Short spherical-astronomy derivations for the closed forms in
`packages/core/src/engine/house-systems.ts`. Notation: φ geographic latitude,
ε obliquity, θ = RAMC (right ascension of the meridian), λ ecliptic longitude,
α right ascension, δ declination. All angles in radians unless noted.

## Regiomontanus

Regiomontanus places cusp _k_ where the ecliptic meets the great circle through the
north and south horizon points and the point on the celestial equator at
RA = θ + _k_ (with _k_ = 30°, 60°, … for houses 11, 12, 2, 3).

Let ρ = θ + _k_. A direction on that great circle (before intersecting the ecliptic)
has components proportional to (cos φ sin ρ, cos φ cos ρ, sin φ) in a horizon-based
frame aligned with the meridian. Rotating into ecliptic coordinates (obliquity ε about
the x-axis) and taking λ = atan2(y, x) gives

```text
λ = atan2( cos φ sin ρ,
           cos φ cos ρ cos ε − sin φ sin k sin ε )
```

with ρ = θ + _k_ and _k_ the house offset in radians (`regiomontanusCusp`).

## Campanus

Campanus divides the prime vertical: cusp _n_ lies where the ecliptic meets the great
circle through the zenith, nadir, and the point on the prime vertical at colatitude
30°·_n_ from the zenith (toward the east horizon for diurnal houses).

Let ψ = 30°·_n_·(π/180) measured from the zenith along the prime vertical. Unit vectors:
zenith **Z** = (0, 0, 1), east **E** = (0, 1, 0), north **N** = (1, 0, 0) in horizon
axes (x north, y east, z up). A point on the Campanus circle:

**P** = cos ψ **Z** + sin ψ (cos θ **N** + sin θ **E**)

Express **P** in equatorial coordinates, then intersect with the ecliptic plane
(_z_<sub>eq</sub> = 0 after obliquity rotation). The implementation uses the
equivalent closed form in `campanusCusp` (branch selection via `branchLongitude`).

## Koch

Koch trisects the semi-diurnal arc (SDA) of the MC degree. With the MC at ecliptic
longitude λ<sub>MC</sub>, its declination δ<sub>MC</sub> and right ascension α<sub>MC</sub>
follow from the oblique spherical triangle. The SDA of the MC (time from MC to horizon
crossing) satisfies

```text
cos SDA = − tan φ tan δ<sub>MC</sub>   (when |tan φ tan δ| < 1)
```

Cusps 11, 12, 2, 3 use RAMC offsets SDA/3 and 2·SDA/3 from the ascendant construction
(`kochCusp`): ascendant at RA = θ ± SDA/3, ± 2·SDA/3, converted to ecliptic longitude
via the standard ascendant formula.

## References (descriptive)

- R. W. Holden, _The Elements of House Division_ (1977)
- Swiss Ephemeris general documentation §6.2–6.4 (swisseph.htm) — letter definitions only

Letters **G**, **H**, **U**, **Y**, **I**, **i** in this codebase were matched to
pyswisseph 2.10 by black-box testing (ADR 0017), not from the formulas above.
