# API reference

## TypeDoc (Starlight)

HTML reference for public package entry points is generated at docs build time:

```bash
pnpm run docs:build
```

Sources: `apps/docs/scripts/generate-api.mjs` (packages: `core`, `analytics`, `prediction`, `match`, `events`, `reporting`, `api`).

Published site path: `/api-reference/` (see [apps/docs](../../apps/docs/README.md)).

## API Extractor rollups

Committed markdown rollups under [`etc/`](../../etc/) are checked in CI (`pnpm run api:check`):

| Package              | Report                                                                                    |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `@node-jhora/core`   | `etc/core.api.md`                                                                         |
| `@node-jhora/format` | `etc/format.api.md` (Zod enum order normalized — `tools/normalize-format-api-report.mjs`) |
| …                    | other `etc/*.api.md`                                                                      |

Regenerate after API changes: `pnpm run api:report` from the repository root.

## JSON Schema

- Chart file: `@node-jhora/format/schema/njh-chart.schema.json`
- Golden cases: `@node-jhora/testkit/schema/golden-case.schema.json`
