# Golden cases

A golden case is one JSON object: who computed the oracle, the chart input, the settings document, and the expected values. `@node-jhora/testkit` publishes the Zod schema (`GoldenCaseSchema`) and `schema/golden-case.schema.json`, generated from that schema plus the feature-path registry.

## Input

| Field | Meaning |
| :--- | :--- |
| `instant` | UTC timestamp with a `Z` suffix |
| `timezone` | IANA zone name |
| `lat`, `lon` | Degrees, north and east positive |
| `alt` | Metres above the WGS84 ellipsoid |
| `settingsPresetId` | Name of the settings document |
| `settingsHash` | SHA-256 hex of the canonical JSON of `settings` |

Canonical JSON sorts object keys at every level and has no whitespace. `settings` is a flat object of strings, finite numbers, and booleans. The schema rejects a hash that does not match that document.

`provenance.source` is `jhora`, `horizons`, `pyswisseph`, or `published-text`. `toolVersion` is the oracle build, or `unrecorded`. `capturedAt` is `YYYY-MM-DD` or `null`.

## Expected paths

`expected` is a map from a feature path to `{ value, tolerance }`. The tolerance kind is fixed by the path:

| Kind | Compared as | Examples |
| :--- | :--- | :--- |
| `arcsec` | numeric angle, slack in arcseconds | `d1.planets.Sun.lon`, `horizons.planets.Moon.lat` |
| `seconds` | instant or duration, slack in seconds | `dasa.vimshottari[0].start`, `siderealTime.hours` |
| `exact` | string, number, or boolean, no slack | `d1.planets.Sun.printed`, `dasa.vimshottari[0].lord` |

Varga prefixes are `d1` to `d60`. Dasa periods are `dasa.<system>[n]` for the maha dasa and `[n][m]...` for up to five sub-levels; `vimshottari` is the only registered system until another dasa engine lands.

Unknown paths fail. The registry is `FEATURE_PATH_RULES` in `packages/testkit/src/paths.ts`. The JSON Schema copies those patterns into `patternProperties` and sets `additionalProperties: false`. The Zod schema also checks the settings hash, the IANA zone, and that `instant` is a real UTC time.

A corpus is a JSON array or JSON Lines (`parseGoldenCorpus`).

## Legacy fixtures

`packages/core/tests/fixtures/jhora_golden.ts` and `horizons_golden.ts` stay in place so the existing engine tests keep importing them. `jhora.golden.json` and `horizons.golden.json` are the same data in the new schema. `packages/testkit/tests/roundtrip.test.ts` converts both ways and compares the result to the TypeScript modules, including every data export.

The legacy modules do not record altitude, an IANA zone, a tool version, or a capture date. The converter uses altitude `0`, `Asia/Kolkata` for the Chennai chart (its offset is +5.5 h), `UTC` and the geocentre for Horizons, and `toolVersion: "unrecorded"`, `capturedAt: null`.

Panchanga percents are exact oracle numbers. Their comparison slack is `meta.panchanga.tolerancePercent`, because the schema has no percent tolerance kind. Vimshottari `toleranceDays` is stored as seconds on each `dasa.vimshottari[n].end`. Horizons body order is `meta.epoch.bodies[n]`; the legacy rows are not Sun-to-Saturn.

Regenerate the JSON Schema and the converted fixtures with `pnpm --filter @node-jhora/testkit generate` (the testkit Jest project with `WRITE_GOLDENS=1`). Plain `pnpm test` fails if either file has drifted from the generator. Do not loosen a tolerance without a decision record.

## Comparator

`@node-jhora/testkit` compares a golden case to a flat `actual` map keyed by feature path:

| API | Role |
| :--- | :--- |
| `compareGoldenCase` / `compareGoldenPaths` | Per-path pass/fail, signed Δ in arcseconds or seconds |
| `formatGoldenReportText` / `Markdown` / `Html` | CI and PR-readable diff artifacts |
| `goldenCompareResultToJson` | Structured JSON report |
| `expectGolden` | Jest helper that throws the text report on failure |

Angles use shortest-arc difference (359°59′59″ vs 0°00′01″ → 2″). `siderealTime.hours` compares slack in seconds of time. Dasa `end` strings compare as UTC midnights. Failed paths are ranked by feature id in `worstByFeature`. Optional `{ only: string[] }` limits which expected paths run (useful when the engine fills a subset).

Example: `packages/core/tests/golden/horizons-comparator.golden.test.ts`.
