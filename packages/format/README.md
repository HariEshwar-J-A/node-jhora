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
