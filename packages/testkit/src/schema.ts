import { z } from 'zod';

import { matchFeaturePath, type ToleranceType, type ValueKind } from './paths.js';
import { sha256Utf8 } from './sha256.js';

/** SHA-256 hex of canonical JSON. Object keys are sorted at every level. */
export function canonicalJson(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
    const record = value as Record<string, unknown>;
    const body = Object.keys(record)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
        .join(',');
    return `{${body}}`;
}

export type SettingsDocument = Record<string, string | number | boolean>;

export function hashSettings(settings: SettingsDocument): string {
    return sha256Utf8(canonicalJson(settings));
}

const finite = z.number().finite();

export const ArcsecEntrySchema = z.strictObject({
    value: finite,
    tolerance: z.strictObject({
        type: z.literal('arcsec'),
        arcsec: finite.nonnegative(),
    }),
});

export const SecondsEntrySchema = z.strictObject({
    value: z.union([finite, z.string()]),
    tolerance: z.strictObject({
        type: z.literal('seconds'),
        seconds: finite.nonnegative(),
    }),
});

export const ExactEntrySchema = z.strictObject({
    value: z.union([finite, z.string(), z.boolean()]),
    tolerance: z.strictObject({
        type: z.literal('exact'),
    }),
});

export const ExpectedEntrySchema = z.union([
    ArcsecEntrySchema,
    SecondsEntrySchema,
    ExactEntrySchema,
]);

export const ProvenanceSchema = z.strictObject({
    source: z.union([
        z.enum(['jhora', 'horizons', 'pyswisseph', 'published-text']),
        /** Long-form oracle labels, such as a JHora DLL capture. */
        z.string().min(1),
    ]),
    /** Tool build that produced the oracle numbers. `unrecorded` when the legacy fixture did not say. */
    toolVersion: z.string().min(1),
    /** Calendar date of the capture, or null when the legacy fixture did not record one. */
    capturedAt: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.null()]),
    /** Ephemeris files or kernel named at capture time. */
    ephemeris: z.string().min(1).optional(),
    /** Generator script and revision that produced the corpus. */
    casesFrom: z.string().min(1).optional(),
});

export const GoldenInputSchema = z.strictObject({
    /** UTC instant. A trailing `Z` is required; offsets are not accepted. */
    instant: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/),
    /** IANA time zone name, validated with `Intl`. */
    timezone: z.string().min(1),
    /** Geodetic latitude, degrees, north positive. */
    lat: finite.min(-90).max(90),
    /** Geodetic longitude, degrees, east positive. */
    lon: finite.min(-180).max(180),
    /** Altitude above the WGS84 ellipsoid, metres. */
    alt: finite,
    settingsPresetId: z.string().min(1),
    /** Lower-case SHA-256 of `canonicalJson(settings)`. */
    settingsHash: z.string().regex(/^[a-f0-9]{64}$/),
});

export const SettingsSchema = z.record(
    z.string().regex(/^[A-Za-z][A-Za-z0-9]*$/),
    z.union([z.string(), finite, z.boolean()]),
);

export const GoldenCaseSchema = z
    .strictObject({
        id: z.string().regex(/^[a-z0-9][a-z0-9._+-]{0,127}$/),
        provenance: ProvenanceSchema,
        input: GoldenInputSchema,
        settings: SettingsSchema,
        expected: z.record(z.string(), ExpectedEntrySchema),
    })
    .superRefine((data, ctx) => {
        const hash = hashSettings(data.settings);
        if (data.input.settingsHash !== hash) {
            ctx.addIssue({
                code: 'custom',
                path: ['input', 'settingsHash'],
                message: `settingsHash must be the SHA-256 of canonical settings JSON (${hash})`,
            });
        }
        if (!isUtcInstant(data.input.instant)) {
            ctx.addIssue({
                code: 'custom',
                path: ['input', 'instant'],
                message: 'instant must be a real UTC timestamp',
            });
        }
        if (!isIanaTimeZone(data.input.timezone)) {
            ctx.addIssue({
                code: 'custom',
                path: ['input', 'timezone'],
                message: `Unknown IANA time zone ${JSON.stringify(data.input.timezone)}`,
            });
        }
        const paths = Object.keys(data.expected);
        if (paths.length === 0) {
            ctx.addIssue({
                code: 'custom',
                path: ['expected'],
                message: 'expected must contain at least one feature path',
            });
        }
        for (const path of paths) {
            const rule = matchFeaturePath(path);
            const entry = data.expected[path];
            if (!entry) continue;
            if (!rule) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['expected', path],
                    message: `Unknown feature path ${JSON.stringify(path)}`,
                });
                continue;
            }
            if (entry.tolerance.type !== rule.tolerance) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['expected', path, 'tolerance', 'type'],
                    message: `${path} requires tolerance ${rule.tolerance}`,
                });
            }
            if (
                !valueOk(rule.valueKind, entry.value) ||
                (path.endsWith('.sign') && !validSign(entry.value))
            ) {
                ctx.addIssue({
                    code: 'custom',
                    path: ['expected', path, 'value'],
                    message: `${path} requires a ${rule.valueKind} value`,
                });
            }
        }
    });

export type GoldenCase = z.infer<typeof GoldenCaseSchema>;
export type ExpectedEntry = z.infer<typeof ExpectedEntrySchema>;

export function parseGoldenCase(input: unknown): GoldenCase {
    return GoldenCaseSchema.parse(input);
}

function valueOk(kind: ValueKind, value: string | number | boolean): boolean {
    switch (kind) {
        case 'number':
            return typeof value === 'number';
        case 'integer':
            return typeof value === 'number' && Number.isInteger(value);
        case 'string':
            return typeof value === 'string';
        case 'boolean':
            return typeof value === 'boolean';
        case 'number-or-string':
            return typeof value === 'string' || typeof value === 'number';
        default: {
            const neverKind: never = kind;
            return neverKind;
        }
    }
}

function validSign(value: string | number | boolean): boolean {
    return typeof value === 'number' && value >= 1 && value <= 12;
}

function isIanaTimeZone(zone: string): boolean {
    try {
        Intl.DateTimeFormat('en-US', { timeZone: zone }).format(0);
        return true;
    } catch {
        return false;
    }
}

/** Reject calendar rollover (`1998-13-01`) that `Date.parse` would accept. */
function isUtcInstant(value: string): boolean {
    const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/.exec(value);
    if (!match) return false;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const iso = date.toISOString();
    if (!iso.startsWith(match[1])) return false;
    if (match[2] === undefined) return true;
    const millis = match[2].padEnd(3, '0');
    return iso.slice(iso.indexOf('.') + 1, iso.indexOf('.') + 4) === millis;
}

export function toleranceTypeOf(entry: ExpectedEntry): ToleranceType {
    return entry.tolerance.type;
}
