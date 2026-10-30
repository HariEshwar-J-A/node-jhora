# Rise/set fixtures

These four JSON files are test oracles only. They are not part of any package's npm `files` list (`@node-jhora/core` publishes `dist`, `node`, `LICENSE`, and `README.md`).

The committed rows are a sample of larger captures, about 130 KB together. Each row is an input and the oracle's rise, set, and transit instants. Nothing here is a table from the DLL's internals.

| File                          | Rows | Provenance                                                                                                                                                                                                             |
| ----------------------------- | ---: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `riseset.jhora-dll.json`      |   13 | JHora 8.0's bundled Swiss Ephemeris 2.02.01 DLL, called as a black box (Wine). Ephemeris: JHora 8.0 `jhcore/ephe` `.se1` (DE431). Latitudes through 64.5°. Captured 2026-10-26 by `tools/generate-riseset-goldens.py`. |
| `riseset.pyswisseph-se1.json` |   13 | The same instants from pyswisseph 2.10.03 as shipped, on `sepl_18.se1` and `semo_18.se1`.                                                                                                                              |
| `riseset.highlat-jhora.json`  |   20 | pyswisseph 2.10.03 slow-method rise/set on the jhora ΔT. That call reproduces the DLL file to ≤ 0.48 s. Latitudes 55–90°, both poles, 1900-06-21 through 2100-01-15. Rows after 2026 use the jhora clock.              |
| `riseset.highlat-modern.json` |   20 | The same grid from the default pyswisseph 2.10.03 call (its own ΔT).                                                                                                                                                   |

The sample keeps every body, both poles, latitudes around the 60° and 65° disc cuts, and the era edges (DLL 1980 and 2024; high latitude 1900, 2027, and 2100), including the March-equinox Sun at ±90°. Tolerances stay at 1 s.
