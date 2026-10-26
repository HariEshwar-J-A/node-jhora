import { PRESET_IDS } from '@node-jhora/core';
import { z } from 'zod';

import { NJH_SCHEMA_VERSION } from './constants.js';
import { isValidIanaTimeZone } from './iana.js';

const finite = z.number().finite();

const utcInstant = z.string().regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/,
    'UTC instant must end with Z',
);

const uuid = z.string().regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
);

const ianaZone = z.string().min(1).superRefine((tz, ctx) => {
    if (!isValidIanaTimeZone(tz)) {
        ctx.addIssue({ code: 'custom', message: `Unknown IANA time zone: ${tz}` });
    }
});

export const ChartKindSchema = z.enum([
    'natal',
    'event',
    'mundane',
    'prasna',
    'return',
    'other',
]);

export const ChartMetadataSchema = z.strictObject({
    kind: ChartKindSchema,
    name: z.string().min(1),
    aliases: z.array(z.string()).default([]),
    sex: z.enum(['female', 'male', 'other', 'unspecified']).optional(),
    notes: z.string().optional(),
});

export const TzResolutionStepSchema = z.strictObject({
    code: z.enum([
        'user_timezone',
        'atlas_lookup',
        'dst_rule',
        'ambiguous_fold',
        'gap_skip',
        'lmt_offset',
        'manual_override',
        'legacy_import',
    ]),
    summary: z.string().min(1),
    /** Local or offset-bearing ISO-8601 when the step records a specific instant. */
    at: z.string().min(1).optional(),
    offsetMinutes: z.number().int().optional(),
    ianaZone: z.string().min(1).optional(),
});

export const TzResolutionTraceSchema = z.strictObject({
    tzdbVersion: z.string().min(1).optional(),
    steps: z.array(TzResolutionStepSchema).min(1),
    resolvedUtc: utcInstant,
});

export const LocalClockSchema = z.strictObject({
    year: z.number().int(),
    month: z.number().int().min(1).max(12),
    day: z.number().int().min(1).max(31),
    hour: z.number().int().min(0).max(23),
    minute: z.number().int().min(0).max(59),
    second: z.number().int().min(0).max(59).default(0),
    millisecond: z.number().int().min(0).max(999).optional(),
});

export const BirthDataSchema = z.strictObject({
    local: LocalClockSchema,
    timezone: ianaZone,
    latitude: finite.min(-90).max(90),
    longitude: finite.min(-180).max(180),
    altitudeMetres: finite,
    placeName: z.string().min(1).optional(),
    countryCode: z.string().regex(/^[A-Z]{2}$/).optional(),
    tzResolution: TzResolutionTraceSchema,
});

export const RectificationNoteSchema = z.strictObject({
    text: z.string(),
    createdAt: utcInstant,
    author: z.string().min(1).optional(),
});

export const RectificationSchema = z.strictObject({
    notes: z.array(RectificationNoteSchema).default([]),
});

export const AttachmentRefSchema = z.strictObject({
    id: uuid,
    kind: z.enum(['url', 'relative_path', 'content_hash']),
    ref: z.string().min(1),
    label: z.string().min(1).optional(),
    mediaType: z.string().min(1).optional(),
});

export const SettingsOverrideSchema = z.discriminatedUnion('kind', [
    z.strictObject({
        kind: z.literal('preset'),
        presetId: z.enum(PRESET_IDS),
    }),
    z.strictObject({
        kind: z.literal('inline'),
        settings: z.record(z.string(), z.unknown()),
    }),
]);

export const ChartProvenanceSchema = z.strictObject({
    engineVersion: z.string().min(1),
    settingsHash: z.string().regex(/^[a-f0-9]{16}$/),
});

export const NjhChartV2Schema = z.strictObject({
    schemaVersion: z.literal(NJH_SCHEMA_VERSION),
    id: uuid,
    metadata: ChartMetadataSchema,
    birth: BirthDataSchema,
    rectification: RectificationSchema.default({ notes: [] }),
    tags: z.array(z.string()).default([]),
    attachments: z.array(AttachmentRefSchema).default([]),
    settingsOverride: SettingsOverrideSchema.optional(),
    savedAt: utcInstant.optional(),
    provenance: ChartProvenanceSchema.optional(),
});

export type ChartKind = z.infer<typeof ChartKindSchema>;
export type ChartMetadata = z.infer<typeof ChartMetadataSchema>;
export type TzResolutionStep = z.infer<typeof TzResolutionStepSchema>;
export type TzResolutionTrace = z.infer<typeof TzResolutionTraceSchema>;
export type LocalClock = z.infer<typeof LocalClockSchema>;
export type BirthData = z.infer<typeof BirthDataSchema>;
export type RectificationNote = z.infer<typeof RectificationNoteSchema>;
export type Rectification = z.infer<typeof RectificationSchema>;
export type AttachmentRef = z.infer<typeof AttachmentRefSchema>;
export type SettingsOverride = z.infer<typeof SettingsOverrideSchema>;
export type ChartProvenance = z.infer<typeof ChartProvenanceSchema>;
export type NjhChartV2 = z.infer<typeof NjhChartV2Schema>;

/** Legacy v1 on-disk shape (migration input only). */
export const NjhChartV1Schema = z.strictObject({
    schemaVersion: z.literal(1),
    name: z.string().min(1),
    birth: z.strictObject({
        instant: utcInstant,
        timezone: ianaZone,
        latitude: finite.min(-90).max(90),
        longitude: finite.min(-180).max(180),
        altitudeMetres: finite.default(0),
    }),
    tags: z.array(z.string()).default([]),
});

export type NjhChartV1 = z.infer<typeof NjhChartV1Schema>;
