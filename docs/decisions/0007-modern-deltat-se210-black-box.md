# ADR 0007: Modern precision profile ΔT from published sources

## Status

Accepted (2026-10-26), revised 2026-10-31 (USNO preds bridge; dual post-bridge forecast)

## Context

`precisionProfile: 'modern'` follows the ΔT layout described in Swiss Ephemeris
programmer manual ch. 7 (SMH2016 spline, AA/USNO observations, tidal n′ correction,
forecast beyond the observed record), built from peer-reviewed coefficients and USNO/IERS
observations. Swiss Ephemeris source code and its ΔT tables are AGPL-licensed and
were not consulted; they must not appear in `packages/core/src`.

The **jhora** profile uses Espenak & Meeus polynomials (NASA GSFC
https://eclipse.gsfc.nasa.gov/SEcat5/deltatpoly.html, public domain) before a tabulated
era. The switch Julian day `JHORA_TABLE_SWITCH_JD = 2317746.130902778` (1633-09-02
15:08:24 UT) is an **oracle-measured** boundary from JHora / SE 2.02 tabulation — no
open publication uses this date (polynomial branches use 1600/1700; UKHO tables start
1620).

SMH2016 Table S15 in this codebase uses decimal years from JD 2451545 with a 365.2425-day
year; that scale is a **code convention** unless confirmed in the S15 supplementary
readme. Tidal ΔT adjustments cite van Gent / NASA forms (`deltat-tidal.ts`).

## Decision

Implement `deltaTModern(jdUT, forecast)` in `packages/core/src/engine/deltat-modern.ts`:

1. **Y < −720** — SMH2016 Table S15 parabola (eq. 4.1) minus the published join offset at
   −720, plus van Gent tidal correction to DE431 n′.

2. **−720 ≤ Y < 1954** — Table S15 cubic spline + tidal; **no** fitted knot-day overshoot
   (pyswisseph’s −720 CE Julian day is an oracle-only spike; see known-gap tests).

3. **1955 ≤ Y ≤ last USNO month** — AA K8–K9 (Bessel) and USNO `deltat.data` monthly rows.

4. **2027–2028** — USNO `deltat.preds` TT−UT at Year 2027.00 and 2028.00
   (`deltat-modern-bridge.ts`, `tools/generate-deltat-modern-bridge.mjs`) for both
   **`published`** and **`oracle-compat`**.

5. **Y > 2028** — post-bridge forecast on the **almanac** year scale (`yTab`), selected by
   **`deltaTForecast`** (default **`'published'`**):
    - **`published`** — UKHO HMNAO lod integration (LVM page) through 2500 CE, SMH2016 eq. 4.1
      beyond with a 100-year linear blend at 2500, plus the existing 100-year hand-off from
      the last bridge second (`deltat-modern-forecast-published.ts`).
    - **`oracle-compat`** — for **2026 ≤ yTab < 2027** only, the in-house cubic + millennial
      parabola with hand-off anchored at the USNO 2028.00 preds second
      (`deltat-modern-forecast-oracle-compat.ts`); **yTab > 2028** uses the same almanac-year
      forecast path as main (bit-identical to pre–dual-forecast behaviour). Tabulated
      observations before **2027** use mean-Gregorian year (JD 2451545, 365.2425 d) for
      oracle-compat monthly/annual interpolation. SMH2016→AA blend runs **1952–1955** on the
      Table S15 year scale (swephprg.htm §29.14).

Envelope ids:

- `modern:…+ukho-lod+smh2016-eq4.1` when `deltaTForecast: 'published'` (default)
- `modern:…+usno-preds-bridge+oracle-compat-forecast` when `deltaTForecast: 'oracle-compat'`

All pyswisseph / SE 2.10 oracle comparisons in tests and `tools/` must pass
`deltaTForecast: 'oracle-compat'` (or `deltaT(jd, 'modern', 'oracle-compat')`).

## Validation vs pyswisseph 2.10 (measured)

Run `node tools/measure-deltat-modern-residuals.mjs` with **`oracle-compat`** after
`pnpm --filter @node-jhora/core build`. Residuals match the prior ADR sweep (< 1e−10 s on
forecast-era almanac-year samples). The **`published`** forecast is checked against HMNAO
table anchors in `deltat-modern-published-forecast.test.ts` (±20 s at listed years, bridge
anchor).

Chart goldens (`modern-se210.golden.test.ts`) assert mode **M** within **1″** and ΔT within
**0.06 s** for UTC ≤ 2026; later UTC cases use the bridge + **`deltaTOverrideSeconds`** from
the fixture (not the native forecast).

## Consequences

- Regenerate USNO tables with `tools/generate-deltat-monthly.mjs` when `deltat.data` updates.
- Regenerate bridge with `tools/generate-deltat-modern-bridge.mjs` when USNO `deltat.preds` updates.
- `jhora` ΔT is unchanged.
- Default chart/API behaviour uses the **published** forecast; opt in to **`oracle-compat`**
  only when matching legacy Swiss Ephemeris 2.10 extrapolation in tests or compatibility tools.
