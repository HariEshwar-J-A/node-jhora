export {
    FEATURE_PATH_RULES,
    anchoredPattern,
    matchFeaturePath,
    type FeaturePathRule,
    type ToleranceType,
    type ValueKind,
} from './paths.js';

export {
    ArcsecEntrySchema,
    ExactEntrySchema,
    ExpectedEntrySchema,
    GoldenCaseSchema,
    GoldenInputSchema,
    ProvenanceSchema,
    SecondsEntrySchema,
    SettingsSchema,
    canonicalJson,
    hashSettings,
    parseGoldenCase,
    type ExpectedEntry,
    type GoldenCase,
    type SettingsDocument,
} from './schema.js';

export { buildGoldenCaseJsonSchema, formatJsonSchema } from './json-schema.js';

export { formatGoldenJson, formatGoldenJsonl, parseGoldenCorpus } from './corpus.js';

export {
    angleDeltaArcsec,
    compareGoldenCase,
    compareGoldenPaths,
    signedAngleDeltaDegrees,
    type CompareGoldenOptions,
    type FeatureWorstOffender,
    type GoldenActual,
    type GoldenCompareResult,
    type PathCompareResult,
} from './compare.js';

export {
    formatGoldenReportHtml,
    formatGoldenReportMarkdown,
    formatGoldenReportText,
    goldenCompareResultToJson,
    type GoldenReportJson,
} from './report.js';

export { expectGolden, installGoldenMatchers } from './jest.js';

export {
    HORIZONS_PRESET_ID,
    JHORA_CASE_ID,
    JHORA_PRESET_ID,
    JHORA_TIMEZONE,
    LEGACY_ALTITUDE_M,
    fromHorizonsGoldenCases,
    fromJhoraGoldenCase,
    toHorizonsGoldenCases,
    toJhoraGoldenCase,
    type DateParts,
    type HorizonsFixture,
    type JhoraFixture,
} from './convert.js';
