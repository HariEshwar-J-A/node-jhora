# Sidereal time: IAU 2006 window and long-term join

Date: 2026-10-31

## Status

Accepted

## Context

`getGMST` in `packages/core/src/engine/coordinates.ts` uses IERS Conventions (2010)
eq. 5.14 (Earth Rotation Angle) and eq. 5.32 (GMST), matching ERFA `era00` / `gmst06`
(BSD-3). Outside Julian days 2396758.5 (1850-01-01) … 2469807.5 (2050-01-01) the
IAU 2006 polynomial is not applied; GMST is built from the mean longitude of the
Earth–Moon barycentre (Simon et al. 1994, A&A 282, 663, §5.8.3) precessed to the
mean equinox of date, plus the UT day fraction.

## Decision

The following are **in-house design choices**, not copied from IERS or ERFA text:

1. **Validity window** — Use the IAU 2006 GMST polynomial only between 1850 and 2050
   (JD bounds above). This matches the practical range of IERS TN 36 eq. 5.32 and
   avoids extrapolating the high-order `t⁴`/`t⁵` terms.

2. **Boundary join** — At the nearer boundary (1850 or 2050), compute
   `offset = gmstIAU2006 − gmstLongTerm` once (with jhora ΔT at that instant) and
   add that constant when using the long-term branch. The offset absorbs frame and
   definition differences between the two formulations; it is **not** fitted to JHora
   or Swiss Ephemeris output.

3. **Light-time / aberration term** — Before precession, subtract
   `(LIGHT_TIME_DAYS × 360°) / 365.2425` from Simon et al. mean Earth longitude
   (~20.5″). This is the classical mean-Sun / light-time adjustment used in long-term
   GMST constructions (cf. Newcomb; Aoki et al. 1982 mean-sun definition). The exact
   arcsecond value follows our AU/c constants, not a separate published constant.

4. **UTC for UT1** — ERA and the UT day fraction use UTC Julian date; UT1−UTC is not
   applied inside GMST (≤ 0.9 s IERS budget, separate from ΔT).

## Consequences

- Documented citations in `coordinates.ts` point to IERS 2010, ERFA, and Simon et al.
  1994 for the **published** parts only.
- Changing the window, join logic, or light-time fraction requires a new ADR and
  re-validation of sidereal-time-dependent tests.

## References

- IERS Conventions (2010), ch. 5, eq. 5.14 and 5.32.
  https://iers-conventions.obspm.fr/content/chapter5/icc5.pdf
- ERFA `era00.c`, `gmst06.c` — https://github.com/liberfa/erfa (BSD-3)
- Simon, J.L. et al. 1994, A&A 282, 663, §5.8.3
