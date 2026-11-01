import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DateTime } from 'luxon';

import { EphemerisEngine } from '../../src/engine/ephemeris.js';

const kernel = new Uint8Array(
    readFileSync(fileURLToPath(new URL('../../../ephe/de440s.bsp', import.meta.url))),
);

function juldayUtc(y: number, m: number, d: number): number {
    return EphemerisEngine.getInstance().julday(DateTime.utc(y, m, d, 12, 0, 0));
}

describe('sidereal houses outside DE440s kernel', () => {
    beforeAll(async () => {
        await EphemerisEngine.getInstance().initialize({ kernel });
    });

    for (const year of [1000, 1600, 2500]) {
        test(`getHouses computes for ${year} on modern and jhora profiles`, () => {
            const eph = EphemerisEngine.getInstance();
            const jd = juldayUtc(year, 6, 15);
            const lat = 13.08;
            const lon = 80.27;
            for (const precisionProfile of ['modern', 'jhora'] as const) {
                expect(() =>
                    eph.getHouses(jd, lat, lon, 'P', true, 27, 0, undefined, {
                        precisionProfile,
                    }),
                ).not.toThrow();
                const h = eph.getHouses(jd, lat, lon, 'P', true, 27, 0, undefined, {
                    precisionProfile,
                });
                expect(h.ascendant).toBeGreaterThanOrEqual(0);
                expect(h.ascendant).toBeLessThan(360);
                expect(h.mc).toBeGreaterThanOrEqual(0);
                expect(h.mc).toBeLessThan(360);
            }
        });
    }
});

describe('Ketu sidereal speed matches Rahu (modern profile)', () => {
    beforeAll(async () => {
        await EphemerisEngine.getInstance().initialize({ kernel });
    });

    test('2000-01-01: Ketu speed equals Rahu speed', () => {
        const eph = EphemerisEngine.getInstance();
        const date = DateTime.utc(2000, 1, 1, 12, 0, 0);
        const planets = eph.getPlanets(
            date,
            { latitude: 13.08, longitude: 80.27 },
            {
                precisionProfile: 'modern',
                zodiac: 'sidereal',
            },
        );
        const rahu = planets.find((p) => p.name === 'Rahu')!;
        const ketu = planets.find((p) => p.name === 'Ketu')!;
        expect(ketu.speed).toBe(rahu.speed);
    });
});
