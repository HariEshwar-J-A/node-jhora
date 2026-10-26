import { z } from 'zod';

import {
    AttachmentRefSchema,
    BirthDataSchema,
    ChartMetadataSchema,
    ChartProvenanceSchema,
    LocalClockSchema,
    NjhChartV2Schema,
    RectificationNoteSchema,
    RectificationSchema,
    SettingsOverrideSchema,
    TzResolutionStepSchema,
    TzResolutionTraceSchema,
} from './schema.js';

function embedded(schema: z.ZodType): Record<string, unknown> {
    const json = z.toJSONSchema(schema) as Record<string, unknown>;
    delete json.$schema;
    return json;
}

/** JSON Schema for `.njh` chart documents at schemaVersion 2. */
export function buildNjhChartJsonSchema(): Record<string, unknown> {
    return {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        title: 'NjhChartV2',
        description:
            'node-jhora .njh chart file (schemaVersion 2). Inline settings must validate against @node-jhora/core CalculationSettings.',
        ...embedded(NjhChartV2Schema),
        $defs: {
            metadata: embedded(ChartMetadataSchema),
            localClock: embedded(LocalClockSchema),
            tzResolutionStep: embedded(TzResolutionStepSchema),
            tzResolutionTrace: embedded(TzResolutionTraceSchema),
            birth: embedded(BirthDataSchema),
            rectificationNote: embedded(RectificationNoteSchema),
            rectification: embedded(RectificationSchema),
            attachment: embedded(AttachmentRefSchema),
            settingsOverride: embedded(SettingsOverrideSchema),
            provenance: embedded(ChartProvenanceSchema),
        },
    };
}

export function formatNjhJsonSchema(): string {
    return `${JSON.stringify(buildNjhChartJsonSchema(), null, 2)}\n`;
}
