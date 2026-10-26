---
'@node-jhora/core': minor
'@node-jhora/ephe-long': minor
'@node-jhora/api': patch
---

Pluggable ephemeris providers: `CompositeEphemerisProvider` routes DE440s (1849–2150, default, unchanged output) and the optional DE431 long-range NJCE chunks (`@node-jhora/ephe-long`, built locally with `pnpm --filter @node-jhora/ephe-long build:chunks`). Adds the `ephemerisPolicy` setting (`auto` | `de440s` | `de431_long`), browser/Node chunk loaders, and proleptic Julian/Gregorian historical date helpers (`julianDayUt`, `civilDateFromJulianDay`). The API birth-date schema accepts astronomical years (year 0 = 1 BC).
