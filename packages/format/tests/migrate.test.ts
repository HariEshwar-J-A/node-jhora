import { DateTime } from 'luxon';

import { migrateV1ToV2, parseNjh, serializeNjh } from '../src/index.js';

function v1At(instant: string, timezone: string) {
    return {
        schemaVersion: 1,
        name: 'Instant Check',
        birth: { instant, timezone, latitude: 40.7128, longitude: -74.006, altitudeMetres: 0 },
        tags: [],
    };
}

/** Rebuild the UTC instant from a migrated chart's wall clock, zone, and recorded offset. */
function instantFromLocal(v2: ReturnType<typeof migrateV1ToV2>): number {
    const { local } = v2.birth;
    const offset = v2.birth.tzResolution.steps[0].offsetMinutes!;
    const wall = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second, local.millisecond ?? 0);
    return wall - offset * 60_000;
}

describe('njh migrations', () => {
    it('migrates schema v1 to v2', () => {
        const v1 = {
            schemaVersion: 1,
            name: 'Legacy Person',
            birth: {
                instant: '2000-01-01T12:00:00Z',
                timezone: 'Asia/Kolkata',
                latitude: 13.0827,
                longitude: 80.2707,
                altitudeMetres: 0,
            },
            tags: ['legacy'],
        };

        const v2 = migrateV1ToV2(v1);
        expect(v2.schemaVersion).toBe(2);
        expect(v2.metadata.name).toBe('Legacy Person');
        expect(v2.birth.local.hour).toBe(9);
        expect(v2.birth.tzResolution.resolvedUtc).toBe('2000-01-01T12:00:00Z');
        expect(v2.tags).toEqual(['legacy']);
    });

    it('parseNjh accepts v1 and returns v2', () => {
        const parsed = parseNjh({
            schemaVersion: 1,
            name: 'Via Parser',
            birth: {
                instant: '2000-01-01T00:00:00Z',
                timezone: 'UTC',
                latitude: 0,
                longitude: 0,
                altitudeMetres: 0,
            },
            tags: [],
        });
        expect(parsed.schemaVersion).toBe(2);
        expect(serializeNjh(parsed)).toContain('"schemaVersion":2');
    });

    it.each([
        ['2000-01-01T12:00:00Z', 'Asia/Kolkata'],
        ['2021-11-07T05:30:00Z', 'America/New_York'], // 01:30 EDT, first pass through the fold
        ['2021-11-07T06:30:00Z', 'America/New_York'], // 01:30 EST, second pass
        ['2021-03-14T07:00:00Z', 'America/New_York'], // just after the spring gap
        ['1945-08-15T12:34:56.789Z', 'Asia/Kolkata'], // war time, milliseconds
        ['2000-01-01T00:00:00.000Z', 'Australia/Lord_Howe'], // 30-minute DST
        ['1880-01-01T00:00:00Z', 'Europe/London'], // pre-standard-time LMT
    ])('preserves the instant %s in %s', (instant, zone) => {
        const v2 = migrateV1ToV2(v1At(instant, zone));
        const expected = DateTime.fromISO(instant, { zone: 'utc' }).toMillis();
        expect(DateTime.fromISO(v2.birth.tzResolution.resolvedUtc).toMillis()).toBe(expected);
        expect(instantFromLocal(v2)).toBe(expected);
        expect(DateTime.fromObject(
            { ...v2.birth.local },
            { zone: v2.birth.timezone },
        ).isValid).toBe(true);
        // The migrated document survives serialisation unchanged.
        expect(parseNjh(serializeNjh(v2))).toEqual(v2);
    });

    it('keeps the two passes through a DST fold distinct', () => {
        const first = migrateV1ToV2(v1At('2021-11-07T05:30:00Z', 'America/New_York'));
        const second = migrateV1ToV2(v1At('2021-11-07T06:30:00Z', 'America/New_York'));
        expect(first.birth.local).toEqual(second.birth.local);
        expect(first.birth.tzResolution.steps[0].offsetMinutes).toBe(-240);
        expect(second.birth.tzResolution.steps[0].offsetMinutes).toBe(-300);
        expect(first.birth.tzResolution.resolvedUtc).not.toBe(second.birth.tzResolution.resolvedUtc);
    });

    it('refuses to drop sub-millisecond digits, but accepts trailing zeros', () => {
        expect(() => migrateV1ToV2(v1At('2000-01-01T00:00:00.1234567Z', 'UTC'))).toThrow(/sub-millisecond/);
        const v2 = migrateV1ToV2(v1At('2000-01-01T00:00:00.123000Z', 'UTC'));
        expect(v2.birth.tzResolution.resolvedUtc).toBe('2000-01-01T00:00:00.123Z');
    });
});
