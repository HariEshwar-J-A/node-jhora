# @node-jhora/format

Versioned **`.njh`** chart files: Zod validation, published JSON Schema, schema migrations, and canonical lossless serialization.

- **Current schema:** `schemaVersion: 2` (`NjhChartV2Schema`).
- **JSON Schema:** [`schema/njh-chart.schema.json`](./schema/njh-chart.schema.json) (generated from Zod; drift-checked in tests).
- **Settings overrides** reuse preset ids and `CalculationSettings` from `@node-jhora/core`.

Regenerate the JSON Schema after schema changes:

```bash
pnpm --filter @node-jhora/format run generate
```

This package uses no Node-only APIs in its runtime code so the same module loads in the browser.

## `.jhd` import / export

Browser-safe parser and writer: `@node-jhora/format/jhd`. Node-only batch folder import:
`@node-jhora/format/node`. See [JHD format notes](./docs/JHD.md) for the line-8 altitude ambiguity.

## CSV import wizard

`csvWizardParse` → `csvWizardSuggestMappings` → `csvWizardValidate` → `csvWizardBuildCharts` implement a four-step CSV import (RFC 4180, delimiter detection, column mapping heuristics, row validation, `.njh` v2 output). Use `csvWizardImport` to run the full pipeline with optional explicit mappings.

**DST / ambiguous local times:** IANA timezone rows resolve wall clock → UTC via `@node-jhora/core` `resolveCivilTime` (same defaults as chart calculation: ambiguous fall-back hours → **earlier** UTC instant; spring-forward gaps → **forward** with a `dst_gap` warning). This is independent of the host `TZ` and the current system date.
