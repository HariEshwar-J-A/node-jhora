---
'@node-jhora/core': minor
---

Add `resolveCivilTime`: local wall-clock time + IANA zone + place → UTC and Julian Day with a `.njh`-compatible `tzResolution` trace. IANA rules come from the runtime `Intl` tz database; exact longitude LMT before 1900 in India, before 1800 elsewhere and before 1582; DST gap (`forward`/`backward`/`reject`) and fold (`earlier`/`later`/`reject`) policies; manual/war-time overrides. Calendar math reuses the shared `time/historical.ts` implementation.
