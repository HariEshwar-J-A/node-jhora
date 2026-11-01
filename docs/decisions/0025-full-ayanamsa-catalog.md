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
   Strict ≤1″ parity on modes with cited anchors matching the oracle. **Deferred (2026-04):**
   modes **2, 6, 7, 14, 30, 39** — see amendment below. Modes **0** and **3** strict on
   kernel JDs after published precession handling.

7. **Fagan/Bradley (mode 0)** — Fagan & Bradley 24°02′31.36″ @ 1950-01-01 with **IAU 2006 /
   Vondrák** accumulated precession matches the pyswisseph 2.10 oracle to ~**0.40″** on kernel
   JDs with **no** extra arcsecond constant. Some third-party ephemeris manuals document a
   **+0.41256″** modern-profile correction when an anchor was tabulated with Newcomb precession;
   applying that offset here moves the residual to ~**0.81″**, so it is recorded only as a
   **known convention difference**, not implemented in library code. Raman (3) omits a similar
   documented +0.828″ entry for the same reason: the primary formula is already ~0.16″.

8. **No oracle-fitted bridges** — Profile-specific arcsecond tweaks chosen to match black-box
   output alone are not embedded in library code.

## Consequences

- Lahiri, KP, J2000, True Citra/Pushya/Mula, and most Babylonian modes match pyswisseph 2.10 to
  ≤1″ on kernel-era JDs where primary sources align.
- Modes 2, 7, 8, 28 are registered (no longer `UnsupportedAyanamsaModeError`).
- API settings expose named `ayanamsa` ids; other public mode numbers use `customAyanamsaMode`.
- Fagan and Raman meet ≤1″ vs pyswisseph 2.10 on DE440s kernel JDs with documented handling;
  De Luce, Djwhal Khul, Yukteshwar, Aldebaran-15°Taurus, Gil Brand GC, and Sheoran remain
  deferred where primary literature does not close the oracle gap without tuning.

## Amendment (2026-04): deferred-mode primary-source review

| Mode | Primary definition used                                                | Residual vs pyswisseph 2.10 (kernel JDs, modern) | Status                                                             |
| ---: | ---------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
|    0 | Fagan & Bradley 24°02′31.36″ @ 1950-01-01; IAU 2006 precession         | ~0.40″                                           | **Strict parity enabled**                                          |
|    2 | De Luce 26°24′47″ @ 1900; zero 4 Jun 1 BCE (1963 p. 5)                 | ~22″ constant                                    | **Deferred** — TT/anchor split vs black-box                        |
|    3 | Raman (1900−397)×50⅓″ @ 1900 (App. A)                                  | ≤0.16″                                           | **Strict parity enabled**                                          |
|    6 | Djwhal Khul Aquarius ingress 2117-07-01 (Bailey/Dawson via public doc) | ~29.8°                                           | **Deferred** — ingress convention, not mean@2117=0 + C1            |
|    7 | Yukteshwar 20°54′36″ @ 1893 equinox (Holy Science; Dawson)             | ~279″ constant                                   | **Deferred** — yuga linear rate (54″/yr from 499 CE) vs IAU2006 C1 |
|   14 | Aldebaran 15° Taurus (=45° ecliptic); Mercier §2.8.7                   | ~127″                                            | **Deferred** — star apparent place vs Babylonian −100 BCE oracle   |
|   30 | Gil Brand golden section 0 Sco–0 Aqu (2014)                            | ~2.1°                                            | **Deferred** — need Brand primary formula, not SE longitude        |
|   39 | Sheoran −60° at 4174 BCE winter solstice                               | ~63.7°                                           | **Deferred** — chronology JD vs true/mean handling                 |

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
