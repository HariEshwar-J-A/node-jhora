# Precision profiles

`CalculationSettings.precisionProfile` picks the conventions for ΔT, the
ayanamsa frame, the house frame and the Placidus iteration. Both profiles are
built only from published formulas and cited datasets (each table carries an
`@provenance` header). Swiss Ephemeris and JHora are used only as black-box
test oracles; their goldens are test fixtures and no engine code reads them.

|                        | `'jhora'` (default)                                                   | `'modern'`                                                                 |
| ---------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Purpose                | Match Jagannatha Hora 8.0                                             | Match pyswisseph / Swiss Ephemeris 2.10.03 (DE431 `.se1`)                  |
| Test oracle            | JHora 8.0's bundled `swedll32.dll` (SE 2.02.01)                       | pyswisseph 2.10.03 on DE431 `.se1` files (not Moshier)                     |
| Golden test            | `tests/golden/jhora-dll.golden.test.ts`                               | `tests/golden/modern-se210.golden.test.ts`                                 |
| ΔT before 1955         | Morrison & Stephenson 2004, Espenak & Meeus 2006, AA record from 1633 | SMH2016 Table S15 + supplement parabola (Y < −720); van Gent n′ correction |
| Tidal correction       | ṅ −26 → −25.8″/cy² (van Gent / Espenak)                               | n′ −25.85 → −25.80″/cy² for Y < 1955 (SE §7)                               |
| Observed ΔT            | AA K8–K9 / USNO through 2019                                          | AA K8–K9 / USNO through 2026 (1 Jan rows)                                  |
| Future ΔT              | Stephenson 1997 + 100-year linear join                                | Stephenson 1997 + 100-year join after 2026 (ADR 0007)                      |
| Ayanamsa default       | geometric                                                             | apparent (SE-apparent frame)                                               |
| House frame default    | JHora's                                                               | SE-apparent                                                                |
| Placidus               | DLL's three-step pole scheme                                          | fully converged                                                            |
| Envelope `deltaTModel` | `jhora-se2.02:…`                                                      | `modern:smh2016-s15+aa-usno-obs2026+st1997`                                |

Precession is Vondrák, Capitaine & Wallace (2011) in both profiles, which is
the model the SE general documentation names. SE documents IAU 2006 nutation
since 2.00. This engine uses the 63 largest terms of IAU 1980 (Meeus), which
differ from IAU 2006/2000A (ERFA `nut06a`) by at most 0.018″ in Δψ and 0.008″
in Δε over 1800–2200. That difference is already included in the measured
errors below.

## Verified accuracy of `'modern'`

Measured against the SE 2.10 goldens (340 cases, 1800–2200, plus DE431 chunk
cases outside DE440s). Each value is the largest error over the ayanamsa, the
seven grahas, true and mean nodes, and ascendant, MC and every cusp for Whole
Sign, Equal, Placidus and Porphyry.

- **ΔT (published era, UTC ≤ 2026):** within **~0.05 s** of `swe_deltat` except
  documented deep-time parabola and join residuals (ADR 0007). pyswisseph samples
  live in test fixtures only.
- **Chart outputs (mode M, UTC ≤ 2026):** every output under **1″** in golden
  tests (no `deltaTOverrideSeconds`). Later dates use Stephenson (1997) only;
  SE 2.10's unpublished future ΔT table is not embedded in the engine.

## Why future ΔT is still a prediction

ΔT measures how far the Earth's rotation has drifted from uniform time. Past
the last IERS observation every model extrapolates. The `'modern'` profile uses the same **published** Stephenson (1997) join as
`jhora` after the USNO record ends (2026). Swiss Ephemeris 2.10's internal
post-2027 tabulation is not reproduced in engine code. For a custom future ΔT,
pin `deltaTOverrideSeconds`.

## Notes

- **Table S15.** Coefficients in `deltat-smh2016.ts`; provenance in
  `packages/core/DATA-SOURCES.md`.
- **Test oracles.** `node tools/generate-deltat-modern-test-fixture.mjs` refreshes
  `tests/fixtures/deltat-pyswisseph-se210.json` from pyswisseph (not shipped).
- **Sidereal time at 2050.** Probed as a black box, SE 2.10's sidereal time
  jumps by −1.9085″ at 2050-01-01, where it switches to its long-term model.
  The constant at that join matches the SE 2.02-era ΔT. So both profiles
  compute the join offset with the `'jhora'` ΔT model. The chart's own ΔT
  (profile or override) still drives sidereal time everywhere else.
