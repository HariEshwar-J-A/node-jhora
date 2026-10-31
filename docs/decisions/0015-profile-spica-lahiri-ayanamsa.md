# ADR 0015: Profile-specific Spica and Lahiri ayanamsa (modern vs jhora)

## Status

Accepted

## Context

Deep-era residuals in the **modern** precision profile against Swiss Ephemeris 2.10
were traced to sidereal zero-point models, not to the Vondrák 2011 precession
frame (see ADR 0014). Black-box measurement and published catalogue data show:

1. **True Chitrapaksha (SE_SIDM 27)** — SE 2.10 uses van Leeuwen 2007 (VizieR
   I/311) Spica astrometry and SIMBAD radial velocity +1.0 km/s, not the
   Hipparcos 1997 (I/239) record the engine used for all profiles. Proper-motion
   differences dominate deep-era drift (~3.5″ at −10000 CE). JHora (SE 2.02)
   matches Hipparcos 1997 to ≤0.06″; changing Spica for the jhora profile would
   regress JHora parity.

2. **Lahiri (SE_SIDM 1)** — The Calendar Reform Committee (Govt of India / CSIR 1955) and Bhatnagar (1990, IAU Symp. 141 p. 186) define the true ayanamsa as
   23°15′00″ on 1956-03-21 0h UT. The engine stores 23°15′00.658″, consistent
   with Bhatnagar's IAE J2000 mean formula plus IAU 2000A Δψ at the anchor.
   Propagation uses the traditional algorithm: precession measured on the **mean
   ecliptic of t0**, not the longitude of the t0 equinox on the ecliptic of date.
   The modern profile also applies +0.13036″ general-precession bridge (IAU 1976
   / IAE vs IAU 2006 p_A, anchor → J2000) and demeans the anchor with IAU 1980
   Δψ at t0; the jhora profile uses the fixed IAU 2000A Δψ at t0 with no bridge.

## Decision

- Store two Spica catalogue records: Hipparcos 1997 for `jhora`, van Leeuwen
  2007 + RV +1 km/s for `modern`. Select via `precisionProfile` in
  `getAyanamsa` / `EphemerisEngine.getAyanamsa`.
- Replace mode 1’s obsolete J1900 epoch anchor with a `lahiri` model kind:
  anchor JD 2435553.5 (0h UT), traditional ecliptic-of-t0 propagation,
  profile-specific demeaning and bridge constants documented in `ayanamsa.ts`
  (CRC 1955, Bhatnagar 1990, IERS/ERFA precession and nutation — not SE source).

## Consequences

- Modern True Citra ayanamsa vs SE 2.10 should stay ≤0.001″ per era after the
  IAU 2000 frame-bias step in the apparent-star pipeline (IERS Conventions 2010
  eq. 5.21; ERFA bi00/bp00, BSD-3).
- Modern **GAST**, true obliquity, and SE-apparent `aya_ex` use IAU 2000A nutation
  with the IAU 2006 adjustment (IERS 2010 §5.6.3, ERFA nut06a); the jhora profile
  keeps IAU 1980. GMST and long-term sidereal-time joins are unchanged.
- Sidereal **mean-node** residuals vs older engine builds are mostly
  **unmasking**: correcting the modern ayanamsa removed a ~6.7 mas bias that had
  been cancelling tropical house-angle error. Per case in 1850–2150,
  `ascErr_PR − ascErr_main ≈ −(ayanErr_PR − ayanErr_main)` to ~10⁻⁵″ mean;
  mean-node tropical longitude change from the profile Spica swap is ≤0.0007″ in
  all eras. True-node work (#311) is separate.
- `ChartSession` / HTTP chart routes must pass `precisionProfile` (and optional
  `deltaTOverrideSeconds`) into house cusps as well as planets so the modern
  profile uses the SE-apparent house frame end-to-end.
- JHora profile Spica and Lahiri oracles remain within existing golden tolerances.
- Callers that invoke `getAyanamsa` directly must pass `profile` when not running
  under `withDeltaTContext`.

## References

- van Leeuwen, F. 2007, A&A 474, 653 (VizieR I/311)
- ESA SP-1200 Hipparcos Catalogue (VizieR I/239)
- Report of the Calendar Reform Committee, Govt of India / CSIR, New Delhi (1955)
- Bhatnagar, A.K. 1990, IAU Symp. 141, 186, DOI 10.1017/S0074180900086745
- IERS Conventions (2010) eq. 5.21 / eq. 5.33 (IAU 2000 frame bias; ERFA bi00/bp00, BSD-3)
- IERS Conventions (2010) §5.5.4 / §5.6.3 (IAU 2000A nutation; ERFA nut00a / nut06a, BSD-3)
- Capitaine, N. et al. 2003, A&A 412, 567 (IAU 2006 precession p_A; ERFA p06e)
- Lieske, J.H. et al. 1977, A&A 58, 1 (IAU 1976 precession; IAE bridge context)
