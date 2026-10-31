# Geometric True Citra parallax outside DE440s

Date: 2026-10-31

## Status

Accepted

## Context

Modern geometric True Chitrapaksha (SE_SIDM 27) applies annual parallax to van
Leeuwen Spica by subtracting the geocentre barycentric position from the star
vector (Urban & Seidelmann, _Explanatory Supplement_, §7.2). After #310 that
offset came only from JPL DE440s when JD(TDB) lay inside the kernel span
(1849-12-26 … 2150-01-22). Outside that window the star place stayed
barycentric, producing an ~8 mas step in ayanamsa at each kernel edge.

## Decision

1. **Long-range Earth position** — Use VSOP87 version E (Earth barycentric
   rectangular variables, J2000 dynamical ecliptic/equinox; Bretagnon &
   Francou 1988, A&A 202, 309). Coefficients are transcribed from VSOP87E.ear
   (CDS/IMCCE catalogue **VI/81**) into `vsop87-earth.data.json` via
   `tools/generate-vsop87-earth-data.mjs`. The evaluator follows the term
   layout in the Bureau des Longitudes VSOP87 documentation (`vsop87.txt`):
   `T**α (S sin φ + K cos φ)` with `φ = Σ a(i)·λ(i)(T)`. Version E is the
   published barycentric geocentre model (not heliocentric VSOP87B + Sun).

1b. **Truncation (ADR 0006 pack budget)** — The shipped JSON keeps a fixed
prefix of each block (descending |S|+|K| in the file). Prefix counts are
recorded in the generator; on a DE440s UT grid the truncated series stays
within **6×10⁻⁵ AU** of DE440 geocentre position and **≤0.001 mas** Spica
parallax vs DE440 (see `measuredMax*` fields in the JSON). Regenerate with
the upstream VI/81 file; do not hand-edit coefficients.

2. **Frame** — VSOP87 rectangular J2000 ecliptic components are rotated to
   mean equator J2000 with the same `meanObliquity(0, J2000)` as the rest of
   the engine. That vector is treated as ICRF-compatible for parallax (same
   convention as fixed-star ICRS propagation). No DE440↔VSOP frame bias constant
   was fitted to oracle output.

3. **DE440 join** — When `EphemerisEngine.initialize()` registers a DE440 SPK
   provider, `earthGeocenterBarycentricAu()` blends DE440 and VSOP87 with weight
   `earthBarycentricDe440BlendWeight()` over ±30 TDB days at each kernel edge
   (smoothstep). Interior kernel dates use DE440 only; exterior dates use VSOP87
   only. At the edges VSOP87 matches DE440 to ≲0.001 mas in Spica parallax in
   probes, so the join step stays below 0.1 mas.

4. **Call option** — `CalculationSettings.starParallax` / `PrecisionOptions.starParallax`
   (modern profile, geometric star ayanamsa only):

    - **`oracle-compat`** (default) — Bit-identical to pre-#322 main: annual parallax
      from DE440 inside the kernel; **barycentric** (no observer offset) outside.
      Matches the full-range oracle kit, which records the same geometric star path
      as pyswisseph 2.10 (including the ~8 mas step at each DE440s edge).

    - **`continuous`** — Physically consistent long-range geometric parallax: DE440
      observer inside the kernel, truncated VSOP87E outside, blended over ±30 TDB
      days at each edge via `earthGeocenterBarycentricAu()`. Opt-in only; sidereal
      positions move relative to the oracle outside the kernel because the oracle
      step is barycentric there, not because the tropical true node changes.

5. **Profiles** — `jhora` geometric True Citra remains barycentric (no observer
   offset). **Apparent** star ayanamsa and all other kinematics keep the DE440
   geocentre vector from `EphemerisEngine.initialize()`; only the modern geometric
   star path reads `starParallax`.

## Consequences

- Default `starParallax: 'oracle-compat'` preserves zero regression on full-range
  oracle cells (TrueNd, mode-27 apparent ayanamsa, etc.).
- `starParallax: 'continuous'` removes the kernel-edge step in geometric True Citra
  at the cost of disagreeing with oracle geometric ayanamsa outside DE440s.
- Regenerating VSOP data requires the upstream VSOP87E.ear file and the generator
  script; do not hand-edit fitted constants in library source.

## References

- Bretagnon P., Francou G. 1988, A&A 202, 309 (VSOP87)
- VSOP87 documentation, Bureau des Longitudes / IMCCE (`vsop87.txt`); Earth data VI/81
- Urban & Seidelmann, _Explanatory Supplement to the Astronomical Almanac_, §7.2
- van Leeuwen F. 2007, A&A 474, 653 (Spica parallax 13.06 mas)
- Park et al. 2021 — DE440s coverage and ICRF alignment (kernel oracles only)
