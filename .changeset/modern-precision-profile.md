---
'@node-jhora/core': minor
---

Add `precisionProfile: 'modern'`, which follows the sources Swiss Ephemeris 2.10 documents: SMH2016 Table S15 ΔT with the tidal correction before 1955, the observed record through 2026 (USNO), then Stephenson (1997). It also uses the apparent ayanamsa and house frame and fully converged Placidus. Against pyswisseph 2.10.03 on DE431 files, every output is under 1″ in the observed ΔT range, and under 1″ on future dates once the oracle's ΔT is injected. Add `deltaTOverrideSeconds` to pin ΔT; it is included in the settings hash. `'jhora'` stays the default and is unchanged. See docs/precision-profiles.md.
