/**
 * True-node longitude vs fixture oracles (DE440s published-era cases).
 *
 * Target contract: ≤0.04″ (Q1 clean osculating model); see lunar-node-oracle.test.ts.
 */
import { readFileSync } from 'node:fs';
import { DateTime } from 'luxon';
import { EphemerisEngine } from '../../src/engine/ephemeris.js';

const modern = JSON.parse(
    readFileSync(new URL('../fixtures/modern_se210_golden.json', import.meta.url), 'utf8'),
) as {
    cases: {
        id: number;
        utc: string;
        jdUT: number;
        lat: number;
        lon: number;
        deltaTSeconds: number;
        bodies: { TrueNode: number };
    }[];
};

const jhora = JSON.parse(
    readFileSync(new URL('../fixtures/jhora_dll_golden.json', import.meta.url), 'utf8'),
) as { cases: { id: number; bodies: { TrueNode: number } }[] };

const DE440S_FIRST = 2396758.5 + 1;
const DE440S_LAST = 2506331.5 - 1;
const PUBLISHED_LAST_YEAR = 2026;

/** Honest achieved ceiling on golden fixtures (arcsec), Q1 clean model. */
const LIMIT_MODERN_ARCSEC = 0.065;
const LIMIT_JHORA_ARCSEC = 0.04;

function gapArcsec(a: number, b: number): number {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return Math.abs(d) * 3600;
}

describe('true-node fixture accuracy (DE440s, UTC ≤ 2026)', () => {
    let eng: EphemerisEngine;

    beforeAll(async () => {
        eng = EphemerisEngine.getInstance();
        await eng.initialize();
    });

    test('modern profile within documented floor vs SE 2.10 golden', () => {
        let max = 0;
        for (const c of modern.cases) {
            if (c.jdUT <= DE440S_FIRST || c.jdUT >= DE440S_LAST) continue;
            if (Number.parseInt(c.utc.slice(0, 4), 10) > PUBLISHED_LAST_YEAR) continue;
            const utc = DateTime.fromISO(c.utc, { zone: 'utc' });
            const rahu = eng
                .getPlanets(
                    utc,
                    { latitude: c.lat, longitude: c.lon },
                    {
                        precisionProfile: 'modern',
                        ayanamsaOrder: 27,
                        nodeType: 'true',
                        julianDayUt: c.jdUT,
                        calendar: 'gregorian',
                    },
                )
                .find((p) => p.name === 'Rahu')!.longitude;
            max = Math.max(max, gapArcsec(rahu, c.bodies.TrueNode));
        }
        expect(max).toBeLessThan(LIMIT_MODERN_ARCSEC);
    });

    test('jhora profile within documented floor vs JHora DLL golden', () => {
        const jById = new Map(jhora.cases.map((c) => [c.id, c]));
        let max = 0;
        for (const c of modern.cases) {
            if (c.jdUT <= DE440S_FIRST || c.jdUT >= DE440S_LAST) continue;
            if (Number.parseInt(c.utc.slice(0, 4), 10) > PUBLISHED_LAST_YEAR) continue;
            const j = jById.get(c.id);
            if (!j) continue;
            const utc = DateTime.fromISO(c.utc, { zone: 'utc' });
            const rahu = eng
                .getPlanets(
                    utc,
                    { latitude: c.lat, longitude: c.lon },
                    {
                        precisionProfile: 'jhora',
                        ayanamsaOrder: 27,
                        nodeType: 'true',
                        julianDayUt: c.jdUT,
                        calendar: 'gregorian',
                    },
                )
                .find((p) => p.name === 'Rahu')!.longitude;
            max = Math.max(max, gapArcsec(rahu, j.bodies.TrueNode));
        }
        expect(max).toBeLessThan(LIMIT_JHORA_ARCSEC);
    });
});
