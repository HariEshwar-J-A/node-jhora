# 14. Sidereal mean ecliptic (O4) vs Vondrák P_Σ

Date: 2026-10-31

## Status

Accepted

## Context

Black-box precession evidence (brief O4): the oracle’s **mean ecliptic of date** is the
Vondrák 2011 mean **equator of date** (Table 2, X_A/Y_A) inclined by **ε_A** (eq. 10),
not the independent Table 1 ecliptic-pole series. A separate CIO matrix **P_Σ** is
defined in Vondrák et al. (2011) §5.5 eq. (24)–(28) from the same X_A/Y_A series.

An ad hoc equinox swap caused tens-of-degrees regressions (ADR 0013). We re-derived the
published constructions in code and tests.

## Decision

1. **Sidereal chart longitudes** stay on `icrfToMeanEclipticOfDate` = R₁(ε_A)·P_fabri·v
   with P_fabri = Vondrák Appendix A.3 (`vondrakPrecessionMatrix`). This already matches
   the O4 equinox line (intersection of mean equator and ε_A-tilt ecliptic) to
   sub-milliarcsecond vs an explicit O4 construction at test epochs (see
   `precession-vondrak.test.ts`).
2. Export **`vondrakEquatorPrecessionMatrixSigma`** (P_Σ from eq. 24–28) for CIO /
   equator-only rotation. Do **not** replace `precessionMatrix` with P_Σ: at |T| ≫ 1 the
   Σ axis differs from the Fabri sidereal equinox by many degrees; using P_Σ for
   sidereal longitudes would move grahas by tens of degrees (construction validated as
   orthonormal, but wrong equinox for ecliptic λ).
3. Deep-era modern residuals vs pyswisseph+DE431 (≈0.5–3.5″ planets) are not removed by
   this change; they require DE431 NJCE coverage and ΔT/frame probes on the full-range
   oracle kit (`tools/speed-sweep.mjs`, `NJCE_DIR`).

## Consequences

- No golden churn from this ADR alone.
- Future CIO/ERA work can call P_Σ directly without conflating it with sidereal O4.
- Per-era tables in PRs must separate **Mo** (oracle ΔT pinned) from native modern ΔT when
  attributing drift.
