# Precision profiles

`CalculationSettings.precisionProfile` picks the conventions for ΔT, the
ayanamsa frame, the house frame and the Placidus iteration. Both profiles are
built only from published formulas and cited datasets (each table carries an
`@provenance` header). Swiss Ephemeris and JHora are used only as black-box
test oracles; their goldens are test fixtures and no engine code reads them.

|                        | `'jhora'` (default)                                                   | `'modern'`                                                    |
| ---------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------- |
| Purpose                | Match Jagannatha Hora 8.0                                             | Follow the sources Swiss Ephemeris 2.10 documents             |
| Test oracle            | JHora 8.0's bundled `swedll32.dll` (SE 2.02.01)                       | pyswisseph 2.10.03 on DE431 `.se1` files (not Moshier)        |
| Golden test            | `tests/golden/jhora-dll.golden.test.ts`                               | `tests/golden/modern-se210.golden.test.ts`                    |
| ΔT before 1955         | Morrison & Stephenson 2004, Espenak & Meeus 2006, AA record from 1633 | SMH2016 Table S15 spline (from −720), SMH2016 parabola before |
| Tidal correction       | ṅ −26 → −25.8″/cy²                                                    | ṅ −25.85 → −25.8″/cy²                                         |
| Observed ΔT            | AA K8–K9 / USNO through 2019                                          | same record, extended with USNO through 1 Jan 2026            |
| Future ΔT              | Stephenson 1997 + 100-year linear join                                | same formula, joined at 2026                                  |
| Ayanamsa default       | geometric                                                             | apparent (SE-apparent frame)                                  |
| House frame default    | JHora's                                                               | SE-apparent                                                   |
| Placidus               | DLL's three-step pole scheme                                          | fully converged                                               |
| Envelope `deltaTModel` | `jhora-se2.02:…`                                                      | `modern:smh2016-s15+aa-usno-obs2026+st1997`                   |

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

- **(a) Observed ΔT range** (year ≤ 2026.0): modern's own ΔT, every output
  under 1″.
- **(b) Future dates**: the oracle's own ΔT is injected with
  `deltaTOverrideSeconds`, every output under 1″. This **validates everything
  except predicted ΔT**.

## Why future ΔT is a prediction

ΔT measures how far the Earth's rotation has drifted from uniform time. It
depends on tidal braking, core–mantle coupling, glacial rebound and ice and
ocean mass changes, so it can only be measured after the fact. Past the last
observation every model extrapolates, and published predictions already differ
by tens of seconds within a few decades. SE 2.10 uses an undocumented
polynomial after 2028. `'modern'` deliberately does not copy it and uses
Stephenson (1997) instead. So for future dates the two disagree by up to
~36 s by 2050 and ~260 s by 2200, which moves the Moon by roughly 0.55″ per
second of ΔT. That gap is a disagreement between predictions, not an error,
and test (b) separates it out.

If you know a better ΔT for a date, pin it with `deltaTOverrideSeconds`. The
override is part of the settings hash, and the envelope records it as
`override:<s>s`.

## Notes

- **Table S15.** The SMH2016 spline (`deltat-smh2016.ts`) was transcribed from
  Stephenson, Morrison & Hohenkerk (2016), Proc. R. Soc. A 472:20160404. All
  54 rows were then compared one by one with Table-S15.txt in the figshare
  supplement (doi:10.6084/m9.figshare.4290866, file
  `rspa20160404_si_002.zip`, MD5 `322c18c812171a2c0c959509e093faf4`,
  downloaded 2026-10-26). Every row is identical.
- **No 1955 blend.** SE 2.10 applies an undocumented blend just before 1955
  where the spline meets the observed record. It is omitted, which leaves a
  ΔT difference of at most 0.66 s (under 0.3″ on every output).
- **Sidereal time at 2050.** Probed as a black box, SE 2.10's sidereal time
  jumps by −1.9085″ at 2050-01-01, where it switches to its long-term model.
  The constant at that join matches the SE 2.02-era ΔT. So both profiles
  compute the join offset with the `'jhora'` ΔT model. The chart's own ΔT
  (profile or override) still drives sidereal time everywhere else.
