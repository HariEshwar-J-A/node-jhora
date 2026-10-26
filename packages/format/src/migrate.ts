import { DateTime } from 'luxon';

import { NJH_SCHEMA_VERSION } from './constants.js';
import { NjhChartV1, NjhChartV1Schema, NjhChartV2, NjhChartV2Schema } from './schema.js';

function newChartId(): string {
    const cryptoObj = globalThis.crypto;
    if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
        return cryptoObj.randomUUID();
    }
    throw new Error('njh: crypto.randomUUID is required to migrate charts without an id');
}

function normalizeUtcInstant(instant: string): string {
    // v2 local clocks stop at milliseconds; refuse to drop sub-millisecond digits silently.
    const fraction = /\.(\d+)Z$/.exec(instant)?.[1] ?? '';
    if (/[1-9]/.test(fraction.slice(3))) {
        throw new Error(`njh: sub-millisecond precision cannot be preserved: ${instant}`);
    }
    const dt = DateTime.fromISO(instant, { zone: 'utc' });
    if (!dt.isValid) throw new Error(`njh: invalid UTC instant: ${instant}`);
    const utc = dt.toUTC();
    if (utc.millisecond === 0) {
        return `${utc.toFormat("yyyy-MM-dd'T'HH:mm:ss")}Z`;
    }
    const iso = utc.toISO({ suppressMilliseconds: false, includeOffset: true });
    if (!iso) throw new Error(`njh: invalid UTC instant: ${instant}`);
    return iso.endsWith('Z') ? iso : `${iso.replace(/([+-]\d{2}:\d{2})$/, '')}Z`;
}

/**
 * v1 → v2 migration stub.
 *
 * v1 stored a single UTC instant; v2 keeps the wall clock and a resolution trace.
 * Local components are derived from the v1 instant in the recorded IANA zone.
 */
export function migrateV1ToV2(v1: NjhChartV1): NjhChartV2 {
    const resolvedUtc = normalizeUtcInstant(v1.birth.instant);
    const zoned = DateTime.fromISO(resolvedUtc, { zone: 'utc' }).setZone(v1.birth.timezone);
    if (!zoned.isValid) {
        throw new Error(`njh: cannot interpret v1 instant in zone ${v1.birth.timezone}`);
    }

    return NjhChartV2Schema.parse({
        schemaVersion: NJH_SCHEMA_VERSION,
        id: newChartId(),
        metadata: {
            kind: 'natal',
            name: v1.name,
            aliases: [],
        },
        birth: {
            local: {
                year: zoned.year,
                month: zoned.month,
                day: zoned.day,
                hour: zoned.hour,
                minute: zoned.minute,
                second: zoned.second,
                millisecond: zoned.millisecond || undefined,
            },
            timezone: v1.birth.timezone,
            latitude: v1.birth.latitude,
            longitude: v1.birth.longitude,
            altitudeMetres: v1.birth.altitudeMetres,
            tzResolution: {
                steps: [
                    {
                        code: 'legacy_import',
                        summary:
                            'Imported from .njh schema v1 (UTC instant expanded in the recorded time zone)',
                        at: resolvedUtc,
                        // Disambiguates a repeated wall-clock hour (DST fold) for readers of local + zone.
                        offsetMinutes: zoned.offset,
                        ianaZone: v1.birth.timezone,
                    },
                ],
                resolvedUtc,
            },
        },
        rectification: { notes: [] },
        tags: v1.tags ?? [],
        attachments: [],
    });
}

export type MigrationFn = (doc: unknown) => NjhChartV2;

const MIGRATIONS: Record<number, MigrationFn> = {
    1: (doc) => migrateV1ToV2(NjhChartV1Schema.parse(doc)),
};

/**
 * Migrate any supported document to the current chart schema.
 * Documents already at {@link NJH_SCHEMA_VERSION} are validated and returned.
 */
export function migrateNjh(doc: unknown): NjhChartV2 {
    if (doc === null || typeof doc !== 'object') {
        throw new Error('njh: chart document must be an object');
    }
    const version = (doc as { schemaVersion?: unknown }).schemaVersion;
    if (version === NJH_SCHEMA_VERSION) {
        return NjhChartV2Schema.parse(doc);
    }
    if (typeof version !== 'number' || !(version in MIGRATIONS)) {
        throw new Error(`njh: unsupported schemaVersion ${String(version)}`);
    }
    let current: unknown = doc;
    let v = version;
    while (v < NJH_SCHEMA_VERSION) {
        const step = MIGRATIONS[v];
        if (!step) throw new Error(`njh: missing migration from schemaVersion ${v}`);
        current = step(current);
        v += 1;
    }
    return NjhChartV2Schema.parse(current);
}
