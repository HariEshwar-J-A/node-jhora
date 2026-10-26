# Ayanamsa and angle data sources

Engine code may embed **only** values transcribed from published definitions cited here.
**JHora, Swiss Ephemeris, and pyswisseph outputs are test oracles only** (fixtures and
golden tests), never implementation constants.

Star-defined modes derive longitudes from the catalogue entries in `ayanamsa.ts` (`STARS`).

## Exposed epoch / star modes (registry)

| Mode | Name              | Anchor / definition                                                                                      | Primary source                                   | Max error (kit)                     |
| ---: | ----------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------- |
|    0 | Fagan/Bradley     | 24°02′31.36″ @ JD 2433282.5                                                                              | Fagan & Firebrace, _Fixed Zodiac Ephemeris_      | &lt;0.5″ vs SE 2.10                 |
|    1 | Lahiri            | 22°27′37.76″ @ JD 2415020.0                                                                              | Indian CRC (1955); QJRAS mean ayanamsa           | &lt;0.1″ modern; &lt;0.1″ JHora DLL |
|    3 | Raman             | (1900−397)×50⅓″ @ JD 2415020.0 + IAU 2006 precession                                                     | B.V. Raman, _Hindu Predictive Astrology_, App. A | &lt;0.2″ vs SE 2.10                 |
|    5 | KP                | 22°21′50″ @ JD 2415020.0                                                                                 | K.S. Krishnamurti, _Krishnamurti Paddhati_       | &lt;1″ vs SE 2.10                   |
|   18 | J2000             | 0° @ JD 2451545.0                                                                                        | IAU J2000.0 mean equinox                         | &lt;0.001″ vs SE 2.10               |
|   27 | True Chitrapaksha | Spica at 180°                                                                                            | Drik Siddhanta; Hipparcos / van Leeuwen ICRS     | &lt;0.05″ modern; &lt;0.02″ JHora   |
|   29 | True Pushya       | δ Cancri at 106°                                                                                         | P.V.R. Narasimha Rao convention                  | &lt;1″ vs SE 2.10                   |
|   35 | True Mula         | λ Scorpii at 240°                                                                                        | Chandra Hari convention                          | &lt;1″ vs SE 2.10                   |
|   46 | Lahiri ICRC       | **true** 23°15′ @ JD 2435553.5 (1956-03-21), mean-stored with IAU 1980 Δψ at anchor, IAU 2006 precession | Govt. of India, CRC _Report_ (1955), Part A      | &lt;0.35″ vs SE 2.10                |

Parity pins: `packages/core/tests/fixtures/ayanamsa_sidm_parity_pins.json` (DE440s kernel
JD 2396760–2490000, six epochs). Modern = `swe_get_ayanamsa_ut`; JHora = geometric DLL
where recorded (modes 1 and 27).

## Long-range oracle sweep (−10000…+10000 CE)

Re-measured after Vondrák 2011 precession (#283) with `tools/measure-ayanamsa-era-max.mjs`
(engine vs **pyswisseph 2.10** `swe_get_ayanamsa_ut`, no fitting). Sample years:
−10000, −9000, …, 2150, 3000, 5000, 8000, 10000 at local noon on 1 Jan (Gregorian when
year ≥ 1582). Eras: `before_5000_bce`, `5000_bce_to_1_bce`, `1_ce_to_1799`,
`1800_to_1848`, `de440s_1849_2150`, `after_2150_ce`.

Epoch modes use published anchors + **IAU 2006 / Vondrák** precession; Swiss Ephemeris uses
its own long-term precession outside the DE440s window, so gaps below are expected honesty
checks, not calibration targets.

| Mode | before_5000_bce | 5000_bce_to_1_bce | 1_ce_to_1799 | 1800_to_1848 | de440s_1849_2150 | after_2150_ce |    JHora geometric |
| ---: | --------------: | ----------------: | -----------: | -----------: | ---------------: | ------------: | -----------------: |
|    0 |           71.2″ |              3.9″ |         0.5″ |         0.4″ |            0.40″ |         10.9″ |                  — |
|    1 |           70.1″ |              4.6″ |         1.0″ |        0.08″ |            0.09″ |         11.6″ | 0.06″ (single pin) |
|    3 |           69.6″ |              4.6″ |         1.0″ |        0.16″ |            0.16″ |         11.9″ |                  — |
|    5 |           70.5″ |              3.6″ |         0.8″ |        0.83″ |            0.83″ |         10.9″ |                  — |
|   18 |           71.8″ |              4.3″ |         0.9″ |       0.005″ |           0.002″ |         10.9″ |                  — |
|   27 |               — |                 — |            — |            — |            0.05″ |             — | 0.02″ (DLL golden) |
|   29 |               — |                 — |            — |            — |            0.02″ |             — |                  — |
|   35 |               — |                 — |            — |            — |            0.07″ |             — |                  — |
|   46 |           71.2″ |              4.0″ |         0.6″ |        0.30″ |            0.30″ |         11.0″ |                  — |

Star modes 27, 29, and 35 need Earth kinematics for the apparent path; samples outside the
DE440s kernel are skipped (no comparison), so only the `de440s_1849_2150` column applies vs
SE. JHora geometric mode 27 uses `jhora_dll_golden.json` (cases inside kernel coverage).

Raw JSON: `tools/ayanamsa-era-max.json` (regenerate with the script above).

## Unsupported SE_SIDM IDs

| Mode | Constant           | Reason                                                                                  |
| ---: | ------------------ | --------------------------------------------------------------------------------------- |
|    2 | `SIDM_DELUCE`      | Published 26°24′47″ in 1900 (De Luce 1963) misses SE 2.10 by ~22″ at B1900              |
|    7 | `SIDM_YUKTESHWAR`  | Published 1894 equinox anchor + IAU precession misses SE 2.10 by arcminutes             |
|    8 | `SIDM_JN_BHASIN`   | No citable primary anchor reproducing SE 2.10 within 1″                                 |
|   28 | `SIDM_TRUE_REVATI` | Published ζ Psc pin + Hipparcos astrometry misses SE 2.10 at kernel edges by arcminutes |

`getAyanamsa` throws {@link UnsupportedAyanamsaModeError} for these modes. Any other
unregistered SE_SIDM code throws {@link UnknownAyanamsaModeError}.
