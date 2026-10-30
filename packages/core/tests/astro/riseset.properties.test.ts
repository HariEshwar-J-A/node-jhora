import { DateTime } from 'luxon';

import {
    EphemerisEngine,
    findRiseSetEvent,
    jdUtFromDateTime,
    riseSetDefinitionFromSettings,
} from '../../src/index.js';
import {
    horizonDipDeg,
    MODERN_BODY_GEOMETRIC_LATITUDE_DEG,
    MODERN_SUN_GEOMETRIC_LATITUDE_DEG,
    riseSetPlaceMode,
} from '../../src/astro/horizon.js';

let engine: EphemerisEngine;

beforeAll(async () => {
    engine = EphemerisEngine.getInstance();
    await engine.initialize();
}, 60_000);

describe('rise/set properties', () => {
    test('polar none is not NaN', () => {
        const def = riseSetDefinitionFromSettings();
        const jd = jdUtFromDateTime(DateTime.fromISO('2024-06-21T00:00:00Z'));
        const out = findRiseSetEvent(
            engine,
            0,
            'rise',
            jd,
            { latitude: 75, longitude: 0, altitude: 0 },
            def,
        );
        if (out.kind === 'time') {
            expect(Number.isFinite(out.jdUt)).toBe(true);
        } else {
            expect(out.reason).toMatch(/polar_/);
        }
    });

    test('Chennai Sun rise is same calendar day', () => {
        const def = riseSetDefinitionFromSettings();
        const jd = jdUtFromDateTime(DateTime.fromISO('2000-01-01T00:00:00Z'));
        const out = findRiseSetEvent(
            engine,
            0,
            'rise',
            jd,
            { latitude: 13.08, longitude: 80.27, altitude: 0 },
            def,
        );
        expect(out.kind).toBe('time');
        if (out.kind === 'time') {
            expect(out.dateTime.toISODate()).toBe('2000-01-01');
        }
    });

    test('modern horizon disc follows the observed latitude cuts', () => {
        const modern = riseSetDefinitionFromSettings(undefined, {
            precisionProfile: 'modern',
            positionMode: 'geometric',
        });
        const jhora = riseSetDefinitionFromSettings(undefined, {
            precisionProfile: 'jhora',
            positionMode: 'geometric',
        });
        expect(riseSetPlaceMode(modern, 0, MODERN_SUN_GEOMETRIC_LATITUDE_DEG)).toBe('apparent');
        expect(riseSetPlaceMode(modern, 0, MODERN_SUN_GEOMETRIC_LATITUDE_DEG + 0.01)).toBe(
            'geometric',
        );
        expect(riseSetPlaceMode(modern, 0, -80)).toBe('geometric');
        expect(riseSetPlaceMode(modern, 2, MODERN_BODY_GEOMETRIC_LATITUDE_DEG)).toBe('apparent');
        expect(riseSetPlaceMode(modern, 2, -(MODERN_BODY_GEOMETRIC_LATITUDE_DEG + 0.01))).toBe(
            'geometric',
        );
        expect(riseSetPlaceMode(jhora, 0, 89)).toBe('geometric');
        expect(riseSetPlaceMode(jhora, 2, 70)).toBe('geometric');
    });

    test('sea-horizon dip is 1.76 arcmin times sqrt(height)', () => {
        expect(horizonDipDeg(0)).toBe(0);
        expect(horizonDipDeg(-5)).toBe(0);
        expect(horizonDipDeg(100)).toBeCloseTo((-1.76 * 10) / 60, 12);
    });
});
