# ADR 0018: Extended vargas, graha-year dashas, and optional outer planets

Date: 2026-10-31

Status: accepted

## Context

A coverage audit (`uploads/coverage.md`, 2026-10-31) listed divisional charts, dasha
systems, and trans-Saturnian bodies present in Jagannatha Hora feature lists but missing
from node-jhora. The engine must stay clean-room (no JHora/Swiss Ephemeris source) and
must not change default chart output for existing callers.

## Decision

### Vargas (BPHS / published commentaries)

Implement classical rules for **D5, D6, D8, D11** and higher harmonics **D81, D108,
D144, D150** in `packages/core/src/vedic/vargas.ts`:

| Chart          | Primary rule                                                            | Sources                                                 |
| -------------- | ----------------------------------------------------------------------- | ------------------------------------------------------- |
| D5 Panchamsa   | Five 6° parts; odd/even sign target tables                              | BPHS varga chapter; Ashtakvarga Jyoti summary           |
| D6 Shashthamsa | Six 5° parts from Aries (odd) or Libra (even)                           | Same                                                    |
| D8 Ashtamsa    | Eight 3°45′ parts; modality start Aries / Leo / Sagittarius             | BPHS; variant swaps fixed/dual anchors                  |
| D11 Ekadasamsa | Antizodiacal count from Aries (BPHS); forward-from-sign variant         | BPHS; IndiaDivine BPHS varga thread                     |
| D81            | Navamsa-of-Navamsa composition (default); 81-fold parivritti variant    | Sanjay Rath, _Principles of Divisional Charts_          |
| D108           | 108 equal parts (Aṣṭottarāṃśa); Navamsa→Dwadasamsa variant              | Rath; IndiaDivine D-108 thread                          |
| D144           | Dwadasamsa-of-Dwadasamsa composition                                    | Rath                                                    |
| D150           | 150 equal parts from occupied sign; alternate index maps to same family | JHora factory index only (Chandra-kala/Nadi literature) |

Named **variants** for D2, D3, D4, D8, D9, D10, D11, D30, D81, D108, D150 are selected
via `vargaVariants` (`vargaOptionsFromVariants`) so JHora preset indexes round-trip without
changing defaults (`index:0` / Parashara schemes).

### Graha-year dashas (BPHS chapter 46)

Add cyclic mahā/antar generators in `packages/prediction/src/dashas/` for:

- Ashtottari (108 y)
- Shodashottari (116 y)
- Dwadashottari (112 y)
- Panchottari (105 y)
- Shatabdika (100 y)
- Chaturashiti-sama (84 y)
- Dwisaptati-sama (72 y)
- Shashti-hayani (60 y)

Sub-period length uses the standard proportional rule:
`subYears = parentStdYears × childStdYears / cycleYears` (same structure as Vimshottari).

**Kalachakra** is documented but throws until the full pada wheel (BPHS 46.46+) is
implemented. **Moola** and **Sudasa** ship as simplified Jaimini-family helpers (kendra
occupancy and Śrī Lagna kendradi) with tests; they are not claimed to match JHora exports.

Existing systems (**Vimshottari, Yogini, Narayana, Chara**) are unchanged.

### Outer planets

`EphemerisEngine.getPlanets` accepts `includeOuterPlanets?: boolean` (default `false`) and
`zodiac?: 'sidereal' | 'tropical'` (default `'sidereal'`). Uranus, Neptune, and Pluto use
NAIF IDs already present in DE440s; body ids **11, 12, 13**. Default nine-body output is
bit-identical.

## Consequences

- API surface grows; run `pnpm --filter @node-jhora/api api:report` when merging.
- Golden tests for new vargas use published structural examples, not JHora DLL output.
- Kalachakra, full Moola, and full Sudasa remain follow-up work.

## References

- Parashara, _Brihat Parashara Hora Shastra_, chapters on vargas and dashas (46.x).
- Sanjay Rath, [Principles of Divisional Charts](https://srath.com/jyoti%E1%B9%A3a/principles-of-divisional-charts/).
- Ashtakvarga Jyoti, [Concept of Divisional Charts](https://ashtakvargajyoti.wordpress.com/2015/01/02/concept-of-divisional-charts-in-vedic-astrology/) (D5/D6/D8/D11 construction summaries).
