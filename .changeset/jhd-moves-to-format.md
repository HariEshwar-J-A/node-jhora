---
"@node-jhora/core": major
"@node-jhora/format": minor
---

Move `.jhd` support from `@node-jhora/core` to `@node-jhora/format/jhd` (breaking for core: `parseJhd`, `jhdToUtcISO`, `JHD_BODY_ORDER`, `sexagesimalToDecimal`, `hasPositions`, `JhdChart`, `JhdBody` are no longer exported from core). Adds a hardened parser with line-numbered errors, a `.jhd` writer, and Node batch folder import via `@node-jhora/format/node`.
