# ADR 0028: Truth profile EOP, DE441 routing, and frame-rate speeds

- Status: accepted
- Date: 2026-11-01
- Deciders: maintainers

Technical story: truth-mode-plan.md steps 5, 7, and 8 (ADR 0027 deferred items).

## Context

The `'truth'` precision profile (ADR 0027) matched ERFA apparent ecliptic longitudes on DE440s, but sidereal time still used UTC as UT1 (~8.6″ GAST residual), ascendants ignored polar motion (~0.3″ at Chennai), dates outside DE440s required explicit DE441 attachment for lunar nodes only, and apparent daily motions omitted the frame rotation rate (~0.15″/day Sun, ~2″/day Moon vs a 1 s ERFA longitude difference).

## Decision

### Step 5 — `@node-jhora/eop` (optional data)

- Ship **IERS `finals2000A.all`** Bulletin A columns: UT1−UTC, xp, yp; plus a SHA-256 pin for **IANA `leap-seconds.list`** (provenance only; modern ΔT unchanged).
- **`eop.bin`** (~131 KB) is committed and SHA-pinned in `pins.json` (`eopBinSha256`). `prepack` runs `verify-prepack.mjs` only (no network). Refresh via `fetch` + `pack-data`.
- Core exposes {@link setIersEopTable} with **no runtime dependency** on the package. When a table is registered and `precisionProfile === 'truth'`, {@link getGAST} uses **ERFA `gst06a`** (transcribed in `gst-erfa.ts`: `era00`, `pnm06a`, `s06`, `eors`, BSD) with **UT1** from the table, and tropical ascendants gain a **polar-motion** longitude correction (IERS 2010 small-angle form). Outside the table span, behaviour matches ADR 0027 (UTC as UT1).

### Step 7 — DE441 outside DE440s

- `CompositeEphemerisProvider` already prefers DE440s inside 1849-12-26..2150-01-22 and DE441 NJCE chunks outside (`auto` policy, ADR 0011).
- **`getBarycentricForLunarNode`** treats `'truth'` like `'modern'` outside the DE440s window so true/mean nodes stay on the long-range kernel.
- Planet positions for `'truth'` use the same composite routing when callers attach `setDe441ChunkStore()`; measured DE440−DE441 join remains in `de440-de441-boundary.json` (sub-arcsecond Moon at overlap).

### Step 8 — Daily motion includes d(frame)/dt

- For `precisionProfile === 'truth'`, {@link EphemerisEngine} daily speeds use a **1 s central difference on the emitted chart longitude** (apparent and geometric), not the geometric Chebyshev-only kinematics path. This captures IAU 2006 precession spin and IAU 2000A Δψ rate in the speed.

### Truth fixture definition (aligned with #331)

- `bench/accuracy/truth/truth_profile_erfa.py` apparent places match core `computePlace`: iterated light-time on TDB split dates, **Sun deflection skipped for the Sun**, Jupiter+Saturn deflection for other bodies (Klioner/ES 2013), relativistic aberration, then `ecm06` + nut06a Δψ on λ only.
- Prior fixture mismatch on Pluto (~0.002″) was **Sun+Jupiter+Saturn deflection in the engine vs Skyfield Sun-only `.apparent()` in the generator**, not DE441 or barycentre ID (all golden epochs use DE440s `pluto barycenter`).

## Measured residuals (engine vs `truth_profile_erfa.json`, 14 cases, EOP loaded)

Golden tolerance: **0.0001″** on every in-window cell; speeds **0.001″/day**.

| Quantity                 |              Max measured | Notes                                                    |
| ------------------------ | ------------------------: | -------------------------------------------------------- |
| Sun/Moon/Pluto/Neptune λ |                2.05×10⁻⁷″ | In-window (1600–2200 TT); ~2×10⁻⁷″ float floor on some λ |
| GAST vs `gst06a`         |                2.05×10⁻⁷″ | `gst-erfa.ts`; ΔT override honored                       |
| Chennai asc / MC         |   1.93×10⁻⁵″ / 3.10×10⁻⁶″ | ERFA obliquity + EOP UT1/xp/yp                           |
| Sun / Moon speed         | 1.77×10⁻⁵″ / 7.20×10⁻⁴″/d | Central difference on chart λ; cap 0.001″/d              |
| True node λ              |                1.36×10⁻⁷″ | Vondrák join vs ERFA mean ecliptic                       |

No constants were fitted to library outputs.

## Consequences

- `'jhora'` and `'modern'` paths unchanged (legacy GAST, UTC as UT1 without EOP, legacy speeds).
- `@node-jhora/core` code pack stays under 1 MB; EOP data is optional (~131 KB tarball contribution from `@node-jhora/eop`).
- Golden fixture regenerated with UT1-aware GAST, Chennai ascendant/MC, speeds, and Neptune grid case from main.

## References

- IERS Conventions (2010); USNO/IERS finals2000A; IANA leap seconds
- ERFA `gst06a` / `pnm06a` / `s06` (BSD-3, NumFOCUS)
- ADR 0011 (DE440/DE441 composite), ADR 0027 (truth profile baseline)
- Internal measured plan: `truth-mode-plan.md`
