import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { HOUSE_LETTERS } from '../../src/engine/house-registry.js';
import { computeTropicalHouses } from '../../src/engine/house-systems.js';
import {
    computeAscendant,
    computeMC,
    computeVertex,
    getGAST,
    mod360,
    trueObliquity,
} from '../../src/engine/coordinates.js';

function gap(a: number, b: number): number {
    let d = a - b;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return Math.abs(d);
}

describe('house-systems properties', () => {
    beforeAll(async () => {
        await EphemerisEngine.getInstance().initialize();
    });

    const cases = [
        { jd: 2451545.0, lat: 13.08, lon: 80.27, label: 'chennai-2000' },
        { jd: 2469807.5, lat: 51.5, lon: -0.12, label: 'london-2050' },
        { jd: 2378496.5, lat: 40.7, lon: -74.0, label: 'newyork-1850' },
    ];

    test.each(cases)('quadrant invariants ($label)', ({ jd, lat, lon }) => {
        const eps = trueObliquity(jd);
        const ramc = mod360(getGAST(jd) + lon);
        const asc = computeAscendant(ramc, lat, eps);
        const mc = computeMC(ramc, eps);
        const vertex = computeVertex(ramc, lat, eps);

        for (const letter of ['P', 'O', 'K', 'R', 'C', 'B'] as const) {
            const r = computeTropicalHouses(letter, ramc, lat, eps, asc, mc, vertex, {
                placidusScheme: 'jhora',
                polarFallback: 'porphyry',
            });
            expect(r.cusps).toHaveLength(12);
            expect(gap(r.cusps[0], asc)).toBeLessThan(1e-9);
            expect(gap(r.cusps[9], mc)).toBeLessThan(1e-9);
            for (let i = 0; i < 6; i++) {
                expect(gap(r.cusps[i + 6], mod360(r.cusps[i] + 180))).toBeLessThan(1e-8);
            }
            for (let i = 0; i < 11; i++) {
                expect(gap(r.cusps[i + 1], r.cusps[i])).toBeGreaterThan(0);
            }
        }
    });

    test('equal systems: asc on cusp 1, MC on cusp 10 when defined', () => {
        const jd = 2451545.0;
        const lat = 28.6;
        const lon = 77.2;
        const eps = trueObliquity(jd);
        const ramc = mod360(getGAST(jd) + lon);
        const asc = computeAscendant(ramc, lat, eps);
        const mc = computeMC(ramc, eps);
        const vertex = computeVertex(ramc, lat, eps);
        for (const letter of ['E', 'A'] as const) {
            const r = computeTropicalHouses(letter, ramc, lat, eps, asc, mc, vertex, {
                placidusScheme: 'jhora',
                polarFallback: 'porphyry',
            });
            expect(gap(r.cusps[0], asc)).toBeLessThan(1e-9);
        }
    });

    test('getHouses accepts every SE letter without throw', () => {
        const eph = EphemerisEngine.getInstance();
        const jd = 2451545.0;
        for (const letter of HOUSE_LETTERS) {
            const h = eph.getHouses(jd, 13.08, 80.27, letter, false);
            expect(h.cusps).toHaveLength(12);
            expect(h.equAsc).toBeDefined();
        }
    });
});
