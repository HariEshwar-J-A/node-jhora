---
'@node-jhora/core': minor
'@node-jhora/analytics': patch
'@node-jhora/api': patch
'@node-jhora/engine': patch
'@node-jhora/match': patch
'@node-jhora/prediction': patch
'@node-jhora/reporting': patch
---

Add the `Body` enum (Rahu = 10, Ketu = 99) and use it across packages. `EphemerisInterpolator.unpack()` now reports node ids 10/99 (was 8/9), matching `getPlanets()`. KP significators keep legacy 7/8.
