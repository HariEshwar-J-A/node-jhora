import { z } from 'zod';

import { FEATURE_PATH_RULES, anchoredPattern } from './paths.js';
import {
    ArcsecEntrySchema,
    ExactEntrySchema,
    GoldenInputSchema,
    ProvenanceSchema,
    SecondsEntrySchema,
    SettingsSchema,
} from './schema.js';

function embedded(schema: z.ZodType): Record<string, unknown> {
    const json = z.toJSONSchema(schema) as Record<string, unknown>;
    delete json.$schema;
    return json;
}

/**
 * JSON Schema for one golden case.
 *
 * Generated from the Zod object schemas. `expected` is rewritten from the
 * feature-path registry so unknown paths fail structural validation as well
 * as `GoldenCaseSchema`.
 */
export function buildGoldenCaseJsonSchema(): Record<string, unknown> {
    const patternProperties: Record<string, unknown> = {};
    for (const rule of FEATURE_PATH_RULES) {
        patternProperties[anchoredPattern(rule)] = { $ref: `#/$defs/${rule.tolerance}Entry` };
    }
    return {
        $schema: 'https://json-schema.org/draft/2020-12/schema',
        title: 'GoldenCase',
        description: 'One node-jhora accuracy case: input, settings, provenance, and per-path expectations.',
        type: 'object',
        additionalProperties: false,
        required: ['id', 'provenance', 'input', 'settings', 'expected'],
        $defs: {
            arcsecEntry: embedded(ArcsecEntrySchema),
            secondsEntry: embedded(SecondsEntrySchema),
            exactEntry: embedded(ExactEntrySchema),
            provenance: embedded(ProvenanceSchema),
            input: embedded(GoldenInputSchema),
            settings: embedded(SettingsSchema),
        },
        properties: {
            id: {
                type: 'string',
                pattern: '^[a-z0-9][a-z0-9._+-]{0,127}$',
            },
            provenance: { $ref: '#/$defs/provenance' },
            input: { $ref: '#/$defs/input' },
            settings: { $ref: '#/$defs/settings' },
            expected: {
                type: 'object',
                minProperties: 1,
                additionalProperties: false,
                patternProperties,
            },
        },
    };
}

export function formatJsonSchema(): string {
    return `${JSON.stringify(buildGoldenCaseJsonSchema(), null, 2)}\n`;
}
