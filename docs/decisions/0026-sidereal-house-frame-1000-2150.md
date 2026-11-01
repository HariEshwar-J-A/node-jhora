# Sidereal house frame (1000–2150 CE window)

Date: 2026-11-01

## Status

Accepted

## Context

Sidereal house cusps and angles are tropical ascendant / MC / vertex built from
Greenwich apparent sidereal time and true obliquity, then shifted by ayanamsa
(and, for the modern apparent sidereal frame, nutation in longitude). Before this
change, the modern profile forced IAU 1980 GAST and obliquity for houses while
subtracting a mismatched ayanamsa and IAU 1980 Δψ, producing multi‑arcsecond
ascendant errors inside 1850–2050. Ketu sidereal speed on the modern profile
subtracted the True Citra rate twice (once on Rahu, again on Ketu).

## Decision

1. **House angles (both precision profiles)** — In `EphemerisEngine.housesIn`, always
   use `trueObliquity(jd, 'modern')` and `getGAST(jd, 'modern')`. Published basis:
   IERS Conventions (2010) eq. 5.14 (ERA), eq. 5.32 (GMST), eq. 5.16 (equation of
   the equinoxes), and Table 5.2e (IAU 2000A nutation series in `nutation-iau2000a.ts`).

2. **Modern apparent sidereal shift** — Subtract
   `getAyanamsa(..., 'apparent', 'modern') + nutationForProfile(T, 'modern').dpsi`.
   Do not call the legacy IAU 1980 `nutation()` helper in the house path.

3. **Outside DE440s (modern houses)** — Modern sidereal houses use the pre-ADR-0026
   main chain (IAU 1980 angles + apparent jhora ayanamsa + IAU 1980 Δψ) so full-range
   verify stays ≤ main. Inside the DE440s interior (after the ±30 d edge blend, ADR 0023)
   and inside the IAU 2006 GMST window (ADR 0019), houses subtract apparent modern
   ayanamsa + `nutationForProfile(T, 'modern').dpsi`.

4. **Jhora profile** — Same modern angles; subtract jhora geometric ayanamsa only
   (no Δψ term).

5. **Ketu speed** — Set Ketu’s sidereal speed equal to Rahu’s (opposite node).

Placidus `'converged'`, polar Porphyry fallback, whole-sign behaviour, and the
long-term GMST join offset (ADR 0019, frozen on jhora ΔT) are unchanged.

## Consequences

- Measured modern ascendant / MC residuals vs pyswisseph 2.10 house oracles drop
  to ~0.003″ / 0.0002″ inside 1850–2050 (DE431 golden) with oracle ΔT; jhora
  ascendant ~0.020″ inside the window after the angle switch.
- Residual floors (mean node, True Citra geometric envelope, Mars on DE431, etc.)
  are documented in the window plan and are not removed by this ADR.

## References

- IERS Conventions (2010), ch. 5, eqs. 5.14, 5.16, 5.32, Table 5.2e.
- Public Swiss Ephemeris documentation §6.1 (IAU 2006/2000 sidereal time 1850–2050).
