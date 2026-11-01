# ADR 0029: Truth profile deep-era frame, houses, and mean node

- Status: accepted
- Date: 2026-11-01
- Deciders: maintainers

Technical story: `deep-era-plan.md` steps 1–4 (main `583270b`).

## Context

Oracle sweep cells marked `!` on mean node and modern-house catalog frames are **not** JHora/math bugs in `'jhora'`/`'modern'`; they come from Meeus vs faom03/DE441, Hipparcos vs van Leeuwen Spica, and IAU 1980 vs IAU 2000A nutation on the `mMain` house path. The `'truth'` profile must follow published ERFA/Vondrák/DE441 definitions without retuning or oracle constants.

## Decision

All items apply only when `precisionProfile === 'truth'`. `'jhora'` and `'modern'` are unchanged.

### 1. Spica (van Leeuwen 2007)

`spicaForProfile('truth')` returns the same record as `'modern'` (`SPICA_MODERN`, VizieR I/311; van Leeuwen 2007, A&A 474, 653). `'jhora'` keeps Hipparcos (ESA SP-1200).

### 2. Mean ecliptic and obliquity outside 1600–2200 TT

Outside JD(TT) 2305448..2524594:

- Chart/planet/star transforms use the **Vondrák two-pole** mean ecliptic (engine `icrfToVondrakTwoPoleMeanEcliptic`, equivalent to ERFA `eraLtecm`, BSD ERFA / Vondrák et al. 2011 A&A 534, A22).
- House ascendant/MC/Vertex/cusps use **true obliquity** built from the **angle between the Vondrák equator and ecliptic poles** (`vondrakPoleObliquityDegrees`), not Table 3 ε_A alone.

Inside the interval, keep IAU 2006 (`ecm06` / existing `mean-ecliptic-iau2006.ts` path).

### 3. Truth sidereal houses

`housesIn` subtracts `ayanamsaAt(mode, jd, 'apparent', 'truth')` only (includes `truthEquinoxOffsetDeg` / IAU 2000A Δψ via the same path as apparent stars). No geometric-jhora branch, no extra `nutation().dpsi`.

### 4. Truth mean node

Proleptic year from JD(TT):

- **−500..+5000:** IERS 2010 eq. 5.43 / `faom03` (unchanged).
- **Outside** with DE441 NJCE loaded: DE441 geocentric Moon on the truth ecliptic, one draconic cycle (P = 6798.383 d, 4 d samples) intercepts averaged over ±250 Julian years (`de441-mean-lunar-node.ts`). Window clipped to loaded kernel span.
- **Else:** faom03 fallback.

`nut06a` still uses faom03 for Ω. Ketu = node + 180°. Intercept caches are recomputed from DE441, not fitted constants.

## Verification

| Check                                                 | Tolerance                                |
| ----------------------------------------------------- | ---------------------------------------- |
| Pole obliquity & `eraLtecm` equinox vs pyerfa fixture | ≤ 0.0001″                                |
| Sidereal ayanamsa zero-point (Sun vs asc)             | 0″                                       |
| DE441 secular node vs Python reference                | ≤ 0.001″ (when fixture + chunks present) |
| Existing `truth_profile_erfa.json` goldens            | 0.0001″ unchanged                        |

Measured DE441 mean-node cost (representative epoch, DE441 attached): see CI log from `truth-deep-era.golden.test.ts` (`cold` / `warm` ms).

## Consequences

- Deep-era truth mean node moves away from jhora/Meeus oracle by the documented DE441−faom03 amount (e.g. ~+3558″ at year −10000); that is expected.
- `@node-jhora/core` remains free of runtime deps; no new npm packages.

## References

- Vondrák, Capitaine & Wallace 2011 (+ 2012 erratum); ERFA `eraLtecm`, `eraLtpequ`, `eraLtpecl` (BSD-3)
- Capitaine, Wallace & Chapront 2005 (IAU 2006 domain)
- Simon et al. 1994; IERS Conventions 2010 eq. 5.43 (`faom03`)
- van Leeuwen 2007; Park et al. 2021 (DE441)
- Internal plan: `deep-era-plan.md`
