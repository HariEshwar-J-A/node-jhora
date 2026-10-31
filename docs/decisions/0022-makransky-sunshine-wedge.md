# 0022. Makransky Sunshine wedge (SE letter `i`)

Date: 2026-10-31

## Status

Accepted

## Context

ADR 0017 documented letter `i` (Makransky Sunshine) as matching Treindl/APC when
`min(DSA, NSA) ≥ 45°`, with a known gap for the long-semi-arc wedge
`min(DSA, NSA) < 45°` where only Treindl geometry was implemented. Coverage item
(2026-10-31) required closing that gap from published definitions, not Swiss
Ephemeris source.

## Decision

Implement Makransky's spherical-trigonometry **Solar House Cusp Algorithm** in
`packages/core/src/engine/makransky-sunshine.ts`, taken only from Bob Makransky,
_Primary Directions: A Primer of Calculation_ (1988):

1. Semi-arcs from ascensional difference `AD = asin(tan δ☉ tan φ)` (p. 147):
   `DSA = 90° + AD`, `NSA = 90° − AD`; trisect each for the eight RA offsets from
   RAMC (day) or RAIC (night).
2. Each intermediate cusp: meridian distance with east/west hour-circle continuation
   when `|X| > 90°` (fig. IV-4, pp. 147–148); zenith distance, pole height, Q, W
   (pp. 36–39); ecliptic intersection `tan λ = sin W / (cos ε cos W − sin ε tan p)`
   with oriented pole for eastern vs western cusp families (pp. 147–148).
3. Southern latitude: use RAIC and rotate non-angular cusps by 180° (p. 148).
4. Circumpolar Sun (`|tan δ tan φ| ≥ 1`): same published limiting arcs as on p. 147;
   engine falls back to Treindl APC on the solar parallel (dispatch only).
5. Registry letters `I` / `i` (Treindl vs Makransky) are named in swephprg.htm only;
   letter `I` remains APC/`apcCuspsFromDeclination`; letter `i` calls
   `makranskySunshineCusps`. `sunshineMakranskyLongArcWedge` remains exported as the
   Treindl/Makransky agreement boundary for tests and docs.

Remove the black-box equator equinox `(RAMC, house) → 0°` table; Makransky's
`DEC = 0` limit is handled by the same formulas (no equinox branch).

## Consequences

- `houses-armc-pyswisseph.test.ts` asserts letter `i` on the fixture without wedge
  skips; wedge parity vs pyswisseph should be re-verified when the fixture gains
  wedge cases.
- Polar-latitude behaviour and the `89.999999°` ascendant clamp are documented in
  `makransky-sunshine.test.ts` (same file as polar fixture tests).

## References

- Bob Makransky, _Primary Directions: A Primer of Calculation_ (1988), pp. 36–39,
  147–148 — sole algorithm source for letter `i`.
- Swiss Ephemeris programmer documentation (swephprg.htm) — registry letter names
  `I` (Treindl) and `i` (Makransky) only; not used for cusp formulas.

## Vondrák precession sign (coverage tidy)

The 2026-10-31 coverage audit did not record a separate Vondrák sign defect in
`precession.md`; `precession-vondrak.test.ts` and matrix-based
`accumulatedPrecession` were re-checked. No sign inversion was found in the
Vondrák 2011 periodic series (erratum C7) relative to the published tables.
