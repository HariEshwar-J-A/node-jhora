# 0017. Clean-room house systems (SE letters and JHora options)

Date: 2026-10-31

## Status

Accepted

## Context

The coverage audit (2026-10-31) recorded four Swiss Ephemeris house letters implemented
on `main` (W, E, P, O) and twenty missing quadrant and equal variants, plus four
missing `ascmc` outputs (equatorial ascendant, Koch and Munkasey co-ascendants, polar
ascendant). Jagannatha Hora also exposes 9-pada equal houses, Surya Siddhanta houses,
cusps anchored at the Moon or Sun, and equal houses with the ascendant in the middle of
house 1 — `cuspsInMiddle` was stored but not applied.

Implementations must remain clean-room: no Swiss Ephemeris or JHora source, no
GPL/AGPL code, and no constants fitted to oracle outputs in `src/` (fixtures only).

## Decision

1. **Single module** — `packages/core/src/engine/house-systems.ts` implements every
   SE letter `A`–`Y` (with `A` aliasing `E`) from published geometric definitions:
   Swiss Ephemeris general documentation §6.2–6.4 (swisseph.htm), Holden (_Elements of
   House Division_, 1977), Munkasey (_An Astrological House Formulary_, 1991), Pullen
   (Astrolog / SE Yahoo group, 2016), Carter (1947), Makransky (1988), and the
   Krusinski/Pisa/Goelzer prose cited in §6.2.13. Regiomontanus and Campanus use the
   closed-form plane intersections documented in oxiephemeris-astro (MIT, docs.rs) — that
   crate was not copied, only the same published geometry.

2. **Polar behaviour** — Placidus and Koch at `|tan φ tan ε| ≥ 1` follow SE §6.4: under
   the default `jhora` profile, cusps fall back to Porphyry and `houseFallback.code`
   records the event (matching JHora’s SE 2.02 DLL). The `modern` profile may set
   `polarFallback: 'error'` for strict callers.

3. **Whole sign sidereal** — Sidereal whole-sign cusps remain sign boundaries of the
   sidereal ascendant (`wholeSignCusps(sidAsc)`), not tropical whole-sign cusps minus
   ayanamsa. This preserves existing W oracle parity.

4. **Extra angles** — `equAsc`, `coAscKoch`, `coAscMunkasey`, and `polAsc` follow SE
   §6.3 (equatorial ascendant at RA = ARMC + 90°; Koch co-asc from ARIC; Munkasey
   co-asc at latitude `90° − φ`; polar asc as Koch’s opposition).

5. **JHora options** (settings, not separate SE letters):
    - `cuspsInMiddle: true` shifts equal-type cusps by −15° so the ascendant sits at
      bhava madhya (JHora factory preset `jhora-default@8.0`).
    - `houseAnchor` (`moon` | `sun` | `aries`) re-roots equal / whole-sign wheels via
      `cuspsFromAnchor`.
    - `houseSystem: 'nine_pada_equal'` — twelve cusps stepping 40° from the ascendant’s
      sign start (360°/9 pada width).
    - `houseSystem: 'surya_siddhanta_houses'` — ascendant from the SS linear obliquity
      term (Burgess / SS III.8–9), then equal 30° houses; full SS rising-time tables are
      **not** implemented (documented limitation).

6. **Known approximations** (acceptable until independent goldens exist):
    - Sunshine (`I` / `i`) uses solar semi-arc RAMC shifts; `i` adds Treindl polar
      meridian stacking per §6.2.15.
    - Gauquelin (`G`) — 36 sectors as three Placidus subdivisions per house.
    - APC (`Y`) — simplified declination-parallel construction.
    - Alcabitius (`B`) — equatorial RA trisection + meridian circles.

## Consequences

- `EphemerisEngine.getHouses` accepts all SE letters; settings/API use snake_case ids
  in `HOUSE_SYSTEM_IDS`.
- Existing W/E/P/O results are unchanged when settings match prior defaults.
- Gauquelin charts expose `gauquelinSectors` (36 longitudes) on `HouseData`.
- SSS houses carry a documented partial definition; practitioners needing full SS tables
  should treat output as indicative until a primary-source table is added.

## References

- Dieter Koch & Alois Treindl, Swiss Ephemeris general documentation §6 (houses),
  https://www.astro.com/swisseph/swisseph.htm
- R. W. Holden, _The Elements of House Division_ (Fowler, 1977)
- Michael Munkasey, _An Astrological House Formulary_ (1991)
- Walter Pullen, sinusoidal house discussion (Swiss Ephemeris Yahoo group, 2016)
- Burgess, _Surya Siddhanta_ (1860), obliquity in chapter 3
- oxiephemeris-astro `houses` module docs (Regiomontanus/Campanus/Koch closed forms)
