# CSV chart import

Bulk natal charts from CSV are handled by **`@node-jhora/format`**, not the HTTP API.

## Pipeline

1. `csvWizardParse` — RFC 4180 parse and delimiter detection
2. `csvWizardSuggestMappings` — column → birth-field heuristics
3. `csvWizardValidate` — row-level errors and warnings (including DST gaps)
4. `csvWizardBuildCharts` — `.njh` v2 output per row

Or call `csvWizardImport` with optional explicit column mappings.

## References

- Package README: `packages/format/README.md` (CSV wizard section)
- DST behaviour uses `@node-jhora/core` `resolveCivilTime` (same rules as chart calculation)
- Lossless chart files: [format package](../reference/README.md)

## License

Commercial deployment requires a license from the owner; see root [LICENSE](../../LICENSE).
