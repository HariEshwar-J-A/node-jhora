---
'@node-jhora/core': minor
'@node-jhora/api': patch
---

Match JHora's bundled Swiss Ephemeris 2.02.01 DLL to under 1″ on every output (planets, nodes, ayanamsa, ascendant, MC, and Whole/Equal/Placidus/Porphyry cusps) across 1800–2200. Adds `precisionProfile: 'jhora'` (the default). It uses the SE 2.02 ΔT record, the geometric True Chitra ayanamsa, and the DLL's three-step Placidus pole scheme with a Porphyry fallback in polar latitudes. Dates outside DE440s now throw a `RangeError` unless DE431 chunks are attached with `setChunkStore()`. ζ Psc astrometry and the radial velocities of all four stars are re-sourced from Hipparcos (van Leeuwen 2007, I/311) and CRVAD-2 (III/254). Chart, shadbala and KP response values shift by sub-arcsecond amounts.
