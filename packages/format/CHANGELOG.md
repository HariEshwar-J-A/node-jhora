# @node-jhora/format

## 3.2.0

### Minor Changes

- de5c127: CSV import: a birth time that falls in a DST gap (a spring-forward local time that does not exist in the row's IANA zone) no longer shifts silently. The row still imports, and `CsvImportResult`, `CsvImportRowResult` and `CsvValidateResult` now carry `warnings` (`CsvRowWarning`, code `dst_gap`) that name the zone, the offsets either side of the transition and the resolved UTC instant. The chart keeps the recorded wall clock, reads it with the pre-transition offset, and records a `gap_skip` step in `birth.tzResolution`. Offset-only rows now match zones independently of the host time zone.
- 5f66762: Add a CSV import wizard (RFC 4180 parser, column mapping, timezone/UTC-offset parsing) that produces `.njh` v2 charts.
- 148c15d: Move `.jhd` support from `@node-jhora/core` to `@node-jhora/format/jhd` (breaking for core: `parseJhd`, `jhdToUtcISO`, `JHD_BODY_ORDER`, `sexagesimalToDecimal`, `hasPositions`, `JhdChart`, `JhdBody` are no longer exported from core). Adds a hardened parser with line-numbered errors, a `.jhd` writer, and Node batch folder import via `@node-jhora/format/node`.

### Patch Changes

- 6598632: Fix JHora `.jhd` sexagesimal packing on lines 4–7: fractional fields are decimal minutes ÷ 100 (not `HH.MMSS`). Adds round-trip coverage against the twelve-chart fictional fixture corpus.
- 3697cf1: npm publish readiness (ADR 0006). Code packages ship only `dist` JS and type declarations, with no source maps, no data and no install scripts, and declare `engines.node >=22` and `{ types, import }` exports. `@node-jhora/core` adds a pinned SHA-256 manifest for DE440s and all 400 DE431 NJCE chunks (`@node-jhora/core` `ephemeris-data` exports), integrity-checking chunk loaders, the `@node-jhora/core/node/ephemeris` resolver (explicit path → installed package → cache → remote, with `NODE_JHORA_CACHE_DIR`, `NODE_JHORA_OFFLINE` and `NODE_JHORA_VERIFY`), and a `node-jhora-ephe` CLI (`where`, `prefetch`, `verify`). `@node-jhora/ephe` drops its `postinstall`, verifies the kernel at `prepack`, and adds type declarations and a provenance `NOTICE.md`; it is now an optional peer of core. `@node-jhora/ephe-long` no longer ships chunk data; the chunks are staged into 40 `@node-jhora/ephe-de431-*` data packages. Ephemeris output is unchanged.
- e04c0e8: Add commercial licensing contact to LICENSE section 4, align package metadata and README license sections, and add npm (Changesets + OIDC) and JSR publish pipelines with version sync checks.
- Updated dependencies [80afc7b]
- Updated dependencies [79b830c]
- Updated dependencies [3d83d2b]
- Updated dependencies [0431d00]
- Updated dependencies [f361f1b]
- Updated dependencies [7722bb5]
- Updated dependencies [6aadd82]
- Updated dependencies [772ab80]
- Updated dependencies [b4c9682]
- Updated dependencies [58542a2]
- Updated dependencies [d7af2ae]
- Updated dependencies [0b65237]
- Updated dependencies [c1d00ed]
- Updated dependencies [2ad5f40]
- Updated dependencies [fd22685]
- Updated dependencies [148c15d]
- Updated dependencies [389d0e6]
- Updated dependencies [b2d83b8]
- Updated dependencies [2a88884]
- Updated dependencies [2a0debc]
- Updated dependencies [aae9e43]
- Updated dependencies [3697cf1]
- Updated dependencies [cd36dbe]
- Updated dependencies [e04c0e8]
- Updated dependencies [0d8062c]
- Updated dependencies [aa42f56]
- Updated dependencies [e9cf6ad]
- Updated dependencies [e5803cb]
- Updated dependencies [7c499a1]
- Updated dependencies [72f3bd7]
    - @node-jhora/core@4.0.0

## 3.1.0

Release notes before per-package changelogs are recorded in the [repository CHANGELOG](../../CHANGELOG.md).
