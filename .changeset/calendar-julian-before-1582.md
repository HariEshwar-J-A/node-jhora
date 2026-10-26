---
'@node-jhora/core': minor
'@node-jhora/api': patch
'@node-jhora/engine': patch
---

Interpret civil dates before 1582-10-15 as Julian by default (JHora / Swiss Ephemeris), with optional `calendar` setting (`auto` | `gregorian` | `julian`). Birth API routes resolve civil time through the shared resolver so Julian leap days (e.g. 1500-02-29) work.
