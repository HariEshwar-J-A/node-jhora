---
'@node-jhora/format': minor
---

CSV import: a birth time that falls in a DST gap (a spring-forward local time that does not exist in the row's IANA zone) no longer shifts silently. The row still imports, and `CsvImportResult`, `CsvImportRowResult` and `CsvValidateResult` now carry `warnings` (`CsvRowWarning`, code `dst_gap`) that name the zone, the offsets either side of the transition and the resolved UTC instant. The chart keeps the recorded wall clock, reads it with the pre-transition offset, and records a `gap_skip` step in `birth.tzResolution`. Offset-only rows now match zones independently of the host time zone.
