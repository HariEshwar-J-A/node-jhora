# ADR 0025: Full ayanamsa catalogue and USER mode

## Status

Accepted

## Context

Public ephemeris documentation lists 47 fixed ayanamsa modes (numbers 0–46) plus USER (255),
reference-epoch variants, and optional sidereal projection flags. node-jhora previously registered
nine modes and threw on the rest. Epoch-defined modes also used scalar accumulated precession
instead of the traditional ecliptic-of-t0 propagation (gap G1 in the coverage audit), causing
deep-era drift vs black-box oracles on Lahiri, Fagan, Raman, KP, and J2000.

## Decision

1. **Registry** — `ayanamsa-registry.ts` lists modes 0–46 with `source` strings pointing to
   primary literature (CRC/Lahiri, Kugler, Huber, Burgess, IAU 1958, Liu et al. 2010, etc.).
   No constants are taken from pyswisseph output in library source; test fixtures may store
   black-box oracles.

2. **Propagation** — Epoch and true-epoch modes use
   `ayan(t) = mean(t0) − λ_{mean equinox of t}(t0)` (ecliptic of t0). Lahiri retains its
   true-at-anchor demeaning and modern/jhora bridge (ADR 0015).

3. **USER mode (255)** — `getAyanamsa(..., { user: { t0Jd, ayanamsaDeg } })` with optional
   `AYANAMSA_FLAGS` (`USER_UT`, `ECL_DATE`, `SSY_PLANE`, `ORIGINAL_PRECESSION`).

4. **Galactic modes 31–33** — Node longitude from IAU 1958 pole (ICRS J2000) with Liu/Zhu/Zhang
   2010 node offset for mode 32 (`ayanamsa-galactic.ts`).

5. **Invariable plane** — `ayanamsa-invariable-plane.ts` (Skvrňanský et al. 2012) supports
   `AYANAMSA_FLAGS.SSY_PLANE` for star-defined modes.

6. **Tests** — `ayanamsa_sidm_parity_pins.json` holds pyswisseph 2.10 fixture pins only.
   Strict ≤1″ parity on modes with cited anchors matching the oracle; modes **0, 2, 3, 6, 7, 14,
   30, 39** deferred where published anchors disagree with the oracle or need further work.

7. **No oracle-fitted bridges** — Profile-specific arcsecond tweaks copied from black-box output
   (e.g. Fagan/Raman “Newcomb correction” table) are not embedded in library code.

## Consequences

- Lahiri, KP, J2000, True Citra/Pushya/Mula, and most Babylonian modes match pyswisseph 2.10 to
  ≤1″ on kernel-era JDs where primary sources align.
- Modes 2, 7, 8, 28 are registered (no longer `UnsupportedAyanamsaModeError`).
- API settings expose named `ayanamsa` ids; other public mode numbers use `customAyanamsaMode`.
- Fagan, Raman, and De Luce may exceed 1″ vs pyswisseph until a citable bridge is documented.

## References

- Report of the Calendar Reform Committee (1955); Indian Astronomical Ephemeris
- Fagan & Bradley; De Luce (1963); B.V. Raman; K.S. Krishnamurti
- F.X. Kugler; P. Huber, _Centaurus_ 5 (1958); J.P. Britton (2010)
- Burgess, _Surya-Siddhanta_; Simon et al. 1994 (mean Sun)
- IAU 1958 galactic pole; Liu, Zhu & Zhang 2010, _A&A_
- Skvrňanský et al. 2012, _A&A_ 543, A133 (invariable plane)
- van Leeuwen 2007; ADR 0015 (Spica/Lahiri profiles)
