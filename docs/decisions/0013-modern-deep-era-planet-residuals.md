# 13. Modern profile deep-era planet residuals (investigation)

Date: 2026-10-31

## Status

Accepted (investigation record; no engine change in this pass)

## Context

Black-box probes (pyswisseph 2.10 + DE431) report modern-profile sidereal
planet longitudes within ~0.07–0.1″ of the oracle for 1850–2150, but growing
residuals in antiquity and far future (for example ~0.53″ for 0..1000 CE,
~0.79″ for −1000..0, up to ~3.5″ near −10000, ~1.9″ after 5000 CE). The
`jhora` profile stays at ~0.02–0.06″ in the DE440s overlap window.

Two independent causes must not be conflated in per-era reporting:

| Mechanism                         | Typical signature                                                                            | Modern deep past                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **ΔT** (TT−UT)                    | Shifts all bodies together; ~0.55″/s on the Moon                                             | ~0.57 s vs SE 2.10 at −10000 (tidal epoch/coefficient layout; see ΔT brief O9) |
| **Frame** (mean ecliptic of date) | Affects sidereal longitudes vs equinox; O4: equator of date + ε_A, not Table 1 ecliptic pole | Dominates once \|ΔT\| is pinned (Mo) or within published ΔT era                |

Precession evidence (stream `prec`, O4): the oracle’s mean ecliptic of date is
the Vondrák 2011 mean equator of date (Table 2) inclined by ε_A (eq. 10), not
the separate long-term ecliptic-pole series (Table 1 / eq. 8). Pole separation
reaches ~31″ at −10000 between those two definitions.

## What was tried

An experimental change replaced the Fabri equinox vector in
`vondrakPrecessionMatrix()` (Vondrák A.3) with an ad hoc obliquity-tilt pole
construction. It did **not** reproduce O4’s small pole offset; it moved
published-era longitudes by tens of degrees and failed the SE 2.10 and JHora
golden suites. **No such change was merged.**

Correct O4 alignment likely requires the equator-only precession formalism in
Vondrák et al. (2011) §5.5 and eq. (28) (P_Σ and the Σ vector), or an
equivalent published construction of the mean equinox consistent with ε_A — not
a naive `cross(equator, tilt)` patch.

## Decision

1. Keep the current precession path until a cited O4 implementation is
   validated against pyswisseph 2.10 on DE431 with `NJCE_DIR` and the
   full-range oracle kit (not only DE440s goldens).
2. Treat deep-era ΔT residuals (modern SMH2016 + tidal layout) as a separate
   track from frame residuals; report both columns in era tables.
3. Do not embed oracle-sampled constants; primary sources remain Vondrák 2011,
   SMH2016, and USNO/IERS ΔT tables (see ADR 0007).

## Consequences

- Target 0.001″ for −10000..+10000 is **not** reachable with the current frame
    - ΔT stack; expect ~0.1″ in the DE440s window and larger gaps deep in time
      until O4 and (where applicable) tidal epoch alignment land with green goldens.
- `tools/speed-sweep.mjs` and `NJCE_DIR` remain the supported way to split
  Jo/M/Mo residuals by era once chunks and `nj-fullrange-oracle-kit` are
  available.
