# @node-jhora/testkit

Private workspace package. Golden-case schema for accuracy tests. It does not depend on the calculation engine.

The Zod schema is `GoldenCaseSchema`. The generated JSON Schema is [`schema/golden-case.schema.json`](./schema/golden-case.schema.json). Feature paths that match no registered pattern fail validation. See [docs/GOLDENS.md](../../docs/GOLDENS.md).
