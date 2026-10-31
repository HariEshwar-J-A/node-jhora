/**
 * Mean lunar node — parity with profile oracles (DE440s window).
 *
 * Engine uses Meeus eq. (47.7). JHora SE 2.02 mean node uses a different
 * secular model (~0.5″ gap); modern SE 2.10 is closer on DE440s.
 */

import { readFileSync } from 'node:fs';
import { DateTime } from 'luxon';
import { EphemerisEngine, type PrecisionOptions } from '../../src/engine/ephemeris.js';

const JHORA = JSON.parse(
    readFileSync(new URL('../fixtures/jhora_dll_golden.json', import.meta.url), 'utf8'),
) as { cases: Case[] };

const MODERN = JSON.parse(
    readFileSync(new URL('../fixtures/modern_se210_golden.json', import.meta.url), 'utf8'),
) as { cases: Case[] };

interface Case {
    id: number;
    utc: string;
    lat: number;
    lon: number;
    jdUT: number;
    bodies: { MeanNode: number };
}

const DE440S_FIRST = 2396758.5 + 1;
const DE440S_LAST = 2506331.5 - 1;

function gapArcsec(a: number, b: number): number {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return Math.abs(d) * 3600;
}

let engine: EphemerisEngine;

beforeAll(async () => {
    engine = EphemerisEngine.getInstance();
    await engine.initialize();
}, 30_000);

function maxMeanNodeError(cases: Case[], precision: PrecisionOptions): number {
    let max = 0;
    for (const c of cases) {
        if (c.jdUT <= DE440S_FIRST || c.jdUT >= DE440S_LAST) continue;
        const utc = DateTime.fromISO(c.utc, { zone: 'utc' });
        const rahu = engine
            .getPlanets(
                utc,
                { latitude: c.lat, longitude: c.lon },
                {
                    ayanamsaOrder: 27,
                    nodeType: 'mean',
                    julianDayUt: c.jdUT,
                    calendar: 'gregorian',
                    ...precision,
                },
            )
            .find((p) => p.name === 'Rahu')!.longitude;
        max = Math.max(max, gapArcsec(rahu, c.bodies.MeanNode));
    }
    return max;
}

describe('mean node golden max error (DE440s)', () => {
    test('jhora profile ≤ 0.55″ vs JHora DLL (Meeus eq. 47.7)', () => {
        const max = maxMeanNodeError(JHORA.cases, { precisionProfile: 'jhora' });
        expect(max).toBeLessThan(0.55);
    });

    test('modern profile ≤ 0.14″ vs SE 2.10 (Meeus eq. 47.7)', () => {
        const max = maxMeanNodeError(MODERN.cases, { precisionProfile: 'modern' });
        expect(max).toBeLessThan(0.14);
    });
});
