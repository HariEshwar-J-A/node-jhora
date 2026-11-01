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
   Strict ≤1″ parity on modes with cited anchors matching the oracle. **Deferred:** modes **2, 6, 7**
   (documented convention gaps; see amendment). Modes **14, 30, 39** strict after primary-definition fixes (2026-04 brief).

7. **Fagan/Bradley (mode 0)** — Fagan & Bradley 24°02′31.36″ @ 1950-01-01 with **IAU 2006 /
   Vondrák** accumulated precession matches the pyswisseph 2.10 oracle to ~**0.40″** on kernel
   JDs with **no** extra arcsecond constant. Some third-party ephemeris manuals document a
   **+0.41256″** modern-profile correction when an anchor was tabulated with Newcomb precession;
   applying that offset here moves the residual to ~**0.81″**, so it is recorded only as a
   **known convention difference**, not implemented in library code. Raman (3) omits a similar
   documented +0.828″ entry for the same reason: the primary formula is already ~0.16″.

8. **No oracle-fitted bridges** — Profile-specific arcsecond tweaks chosen to match black-box
   output alone are not embedded in library code.

9. **Deferred-mode fixes (2026-04 research brief)** — Djwhal Khul (6): mean **30°** @ 2117-07-01
   UT (Dawson/Ribaudo letters). Yukteswar (7): **20°54′36″** @ mean March equinox 1894 (Meeus AA
   ch. 27, periodic terms omitted). Aldebaran (14): freeze HIP 21421 at JD 1684532.5 (van Leeuwen
   2007), propagate as epoch. Gil Brand (30): Sgr A* at **210° + 90/φ²** (Brand 2014). Sheoran (39):
   δ Cancri apparent path at **103°29′32.9375″** (Sheoran 2017 Table 1.16). De Luce (2): unchanged
   anchor; **−22.06″** flat oracle gap documented.

## Consequences

- Lahiri, KP, J2000, True Citra/Pushya/Mula, and most Babylonian modes match pyswisseph 2.10 to
  ≤1″ on kernel-era JDs where primary sources align.
- Modes 2, 7, 8, 28 are registered (no longer `UnsupportedAyanamsaModeError`).
- API settings expose named `ayanamsa` ids; other public mode numbers use `customAyanamsaMode`.
- Fagan and Raman meet ≤1″ vs pyswisseph 2.10 on DE440s kernel JDs with documented handling;
  De Luce, Djwhal Khul, and Yukteswar remain deferred with documented flat oracle gaps; Aldebaran,
  Gil Brand, and Sheoran meet ≤1″ on kernel JDs after primary-definition implementation.

## Amendment (2026-04): deferred-mode primary-source review

| Mode | Primary definition used                                            | Residual vs pyswisseph 2.10 (kernel JDs, modern) | Status                                                               |
| ---: | ------------------------------------------------------------------ | ------------------------------------------------ | -------------------------------------------------------------------- |
|    0 | Fagan & Bradley 24°02′31.36″ @ 1950-01-01; IAU 2006 precession     | ~0.40″                                           | **Strict parity enabled**                                            |
|    2 | De Luce 26°24′47″ @ 1900 Jan 0.5 (De Luce 1963, p. 5)              | **−22.06″** flat                                 | **Deferred** — no published sentence closes TT/anchor convention gap |
|    3 | Raman (1900−397)×50⅓″ @ 1900 (App. A)                              | ≤0.16″                                           | **Strict parity enabled**                                            |
|    6 | Mean 30° @ 2117-07-01 UT (Dawson/Ribaudo; Bailey journal)          | **−4.88″** flat                                  | **Deferred** — no published offset for remaining convention gap      |
|    7 | 20°54′36″ @ mean March equinox 1894 (_Holy Science_; Meeus ch. 27) | **−329.36″** flat                                | **Deferred** — book digits vs black-box convention; no 54″/yr rate   |
|   14 | Freeze Aldebaran (van Leeuwen 2007 HIP 21421) @ JD 1684532.5 − 45° | **+0.033″**                                      | **Strict parity enabled**                                            |
|   30 | Gil Brand GC at 210° + 90/φ² (Brand 2014)                          | peak **0.37″** (GC reduction drift 0.67″)        | **Strict parity enabled**                                            |
|   39 | Sheoran δ Cancri at 103°29′32.9375″ (Sheoran 2017)                 | **+0.58″**                                       | **Strict parity enabled** (book vs oracle, not fitted)               |

An opt-in **oracle-compat** variant could document the black-box convention (e.g. Djwhal mean
at 2117, optional Raman +0.828″ from reference-manual tables) without embedding fitted
constants in the default registry.

## References

- Report of the Calendar Reform Committee (1955); Indian Astronomical Ephemeris
- Fagan & Bradley; De Luce (1963); B.V. Raman; K.S. Krishnamurti
- F.X. Kugler; P. Huber, _Centaurus_ 5 (1958); J.P. Britton (2010)
- Burgess, _Surya-Siddhanta_; Simon et al. 1994 (mean Sun)
- IAU 1958 galactic pole; Liu, Zhu & Zhang 2010, _A&A_
- Skvrňanský et al. 2012, _A&A_ 543, A133 (invariable plane)
- van Leeuwen 2007; ADR 0015 (Spica/Lahiri profiles)
