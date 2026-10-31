# ADR 0016: ELP/MPP02 + DE441 mean node (hybrid retains Meeus)

- Status: accepted (infrastructure; production path unchanged)
- Date: 2026-10-31
- Deciders: maintainers

## Context

ADR 0012 left `meanLunarNode` on Meeus eq. 47.7. This change adds the clean-room
stack from the nodes2 Q2 brief:

1. **Base** — ELP/MPP02 W3 nominal (LLR) on J2000 ecliptic + IAU 2006 `p_A`
   (`generalPrecessionLongitudeArcsec`) within ±10 centuries of J2000, else
   `accumulatedPrecession` (Vondrák 2011).
2. **Long-term correction** — Reproducible DE441 table (`mean-lunar-node-lt-corr.generated.ts`)
   from `tools/derive-mean-node-de441-correction.mjs` (Hann-weighted local quadratic,
   100 yr half-window, ≤2 d grid, Q1 true node without precession spin).
3. **Blend** — Correction fades to zero over 0–2900 CE (±100 yr ramps).
4. **Hybrid** — Prefer Meeus when it wins per era against the oracle fixture.

## Measurement (after table generation)

`node tools/mean-node-era-report.mjs` with hybrid enabled for ELP only (`meanLunarNodeUsesMeeusHybrid` → false) shows **no era** where ELP+DE441 beats Meeus on **maximum** |Δ| vs JHora (806 fixture cases; 11 isolated years favour ELP but every 500-year bucket max is still Meeus).

With hybrid forced to Meeus at all dates (zero-regression gate), era maxima match ADR 0012 / Meeus-only.

ELP base alone is ~0.38″ vs JHora at J2000 (nominal LLR + `p_A`); Meeus remains ~0.02″ there.

## Decision

Measured over the 806-case oracle fixture, the ELP+DE441 hybrid never beats Meeus on any 500-year era maximum, so production stays on Meeus and the ELP/DE441 stack remains dormant behind `meanLunarNodeUsesMeeusHybrid`.

- Ship base math, generated century table, and derivation tool.
- **Production `meanLunarNode` / ephemeris mean node:** hybrid returns **Meeus** until a revised true-node frame or smoothing definition closes the DE441 gap without oracle fitting.
- Do **not** tighten `lunar-node-known-gap.test.ts` ceilings yet.

## Regenerate correction table

```bash
pnpm build
node tools/derive-mean-node-de441-correction.mjs --write
```

Requires `packages/ephe441/.cache/de441_part-{1,2}.bsp` (not committed). MD5s are recorded in the generated file header.

## References

- Chapront & Francou (2003); Chapront et al. (2002); Park et al. (2021) DE441
- `packages/core/src/engine/mean-lunar-node.ts`
- `tools/mean-node-hybrid-pick.mjs` — era win counts
