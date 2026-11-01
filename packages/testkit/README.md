# @node-jhora/testkit

Private workspace package. Golden-case schema for accuracy tests. It does not depend on the calculation engine.

The Zod schema is `GoldenCaseSchema`. The generated JSON Schema is [`schema/golden-case.schema.json`](./schema/golden-case.schema.json). Feature paths that match no registered pattern fail validation. See [docs/guides/goldens.md](../../docs/guides/goldens.md).

## Comparator

`compareGoldenCase(goldenCase, actual)` walks every expected feature path, applies arcsecond (wrap-aware), second, or exact tolerances, and returns per-path deltas plus worst offenders grouped by feature id. Reports: `formatGoldenReportText`, `formatGoldenReportMarkdown`, `formatGoldenReportHtml`, and `goldenCompareResultToJson`. The comparator core is browser-safe (no Node built-ins).

In Jest:

```typescript
import { expectGolden } from '@node-jhora/testkit';

expectGolden(goldenCase, { 'd1.planets.Sun.lon': 229.99 });
```
