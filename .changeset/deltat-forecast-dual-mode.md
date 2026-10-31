---
'@node-jhora/core': minor
'@node-jhora/engine': patch
---

Add `deltaTForecast` on calculation settings (`'published' | 'oracle-compat'`, default `'published'`) for the modern ΔT post-bridge path. `'oracle-compat'` preserves the legacy in-house curve used by pyswisseph 2.10 test oracles; `'published'` uses UKHO lod integration and SMH2016 eq. 4.1. Envelope `deltaTModel` ids now name the active forecast.
