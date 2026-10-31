# ADR 0011: DE440s / DE441 composite ephemeris routing

- Status: accepted
- Date: 2026-10-31
- Deciders: maintainers

## Context and Problem Statement

`@node-jhora/core` ships a pure-TypeScript reader for the short JPL **DE440s**
kernel (1849–2150). Dates outside that window need a long-range JPL kernel.
Issue #260 added optional **DE431** NJCE chunks (`@node-jhora/ephe-long`).
JPL’s successor long-span ephemeris is **DE441** (−13200 to +17191), published as
`de441_part-1.bsp` and `de441_part-2.bsp` on NAIF (same ephemeris as the
3.08 GB `de441.bsp` monolith on ssd.jpl.nasa.gov).

Horizons uses DE441 for astrometric oracles in `horizons_golden.ts`. For
deep-time accuracy aligned with JPL’s current long-span model, the engine should
prefer DE441 outside the DE440s window while keeping DE440s byte-identical
inside it.

## Decision Outcome

1. **Inside DE440s** (`JD(TDB)` 2396752.5–2506352.5): always **DE440s** when
   `ephemerisPolicy` is `auto` (unchanged outputs and goldens).
2. **Outside DE440s** with `auto`: use **DE441** NJCE chunks when attached via
   `setDe441ChunkStore()`; fall back to **DE431** chunks when DE441 is absent
   (`setChunkStore()`).
3. Explicit policies: `de440s`, `de441_long`, `de431_long` (legacy).
4. Data: `@node-jhora/ephe441` build scripts cut `.njce` files from DE441
   part-1/part-2; nothing is committed to git. Opt-in download via
   `node-jhora-ephe prefetch de441` (after manifest generation) or env paths
   `DE441_PART1_PATH` / `DE441_PART2_PATH` for the builder.

### Measured DE440 vs DE441 (maintainer BSP run)

Positions are barycentric km from Type-2 Chebyshev evaluation of the official
BSP files. Regenerate with `tools/measure-de440-de441-boundary.mjs` (requires
NAIF `de440s.bsp`, `de441_part-1.bsp`, `de441_part-2.bsp`). Committed fixture:
`packages/core/tests/fixtures/de440-de441-boundary.json`
(`measuredAt`: 2026-10-31T04:18:18.345Z; DE440s MD5
`3917ee56769db332790c751e2168843d`; part-1 `7e5fcf9ecb5d08e1ab70c049baa60cd3`;
part-2 `ad8dfa4e505ef0e3a5d587a5b4705632`).

| Epoch (TDB)        | Body    | Δ arcsec (DE441 − DE440s) |
| ------------------ | ------- | ------------------------: |
| 1849-12-26 (start) | Sun     |                 9.4×10⁻¹² |
| 1849-12-26 (start) | Moon    |                 2.53×10⁻⁵ |
| 1849-12-26 (start) | Mercury |                         0 |
| 1849-12-26 (start) | Mars    |                         0 |
| J2000.0            | Sun     |                         0 |
| J2000.0            | Moon    |                 9.35×10⁻⁷ |
| J2000.0            | Mercury |                         0 |
| J2000.0            | Mars    |                         0 |
| 2150-01-22 (end)   | Sun     |                         0 |
| 2150-01-22 (end)   | Moon    |                 2.24×10⁻⁵ |
| 2150-01-22 (end)   | Mercury |                 2.5×10⁻¹¹ |
| 2150-01-22 (end)   | Mars    |                 2.8×10⁻¹¹ |

DE441 part-1 vs part-2 at overlap mid-1969 (`JD` 2440416.5): Sun, Moon,
Mercury, Mars all **0** arcsec at float64 evaluation (same ephemeris split).

These deltas are arcseconds of barycentric position difference, not geocentric
along-track lunar separation. JPL still documents meter-level planet agreement
and larger lunar model differences in other frames; the fixture pins what our
BSP reader actually sees at routing boundaries.

## Consequences

- Good: Horizons-era deep time uses the same JPL kernel family as modern
  astrometry oracles without Swiss Ephemeris.
- Good: DE431 long-range path remains for existing installs.
- Bad: DE441 chunk manifest is empty until a maintainer runs `build:chunks` +
  `generate:manifest`; CI skips live BSP tests without local files.

## References

- Park et al., AJ 161, 105 (2021) — DE440/DE441
- https://ssd.jpl.nasa.gov/planets/eph_export.html
- NAIF `de441_tech-comments.txt`
