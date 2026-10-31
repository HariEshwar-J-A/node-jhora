import {
    makranskyIntermediateCusp,
    makranskySunCircumpolar,
    makranskySunshineCusps,
} from '../../src/engine/makransky-sunshine.js';
import { computeAscendant, computeMC, computeVertex } from '../../src/engine/coordinates.js';
import {
    computeTropicalHouses,
    sunshineMakranskyLongArcWedge,
    treindlSunshineCusps,
} from '../../src/engine/house-systems.js';

const EPS = 23.439291;

function sunDeclFromLon(lon: number, eps: number): number {
    return (
        Math.asin(Math.sin(lon * (Math.PI / 180)) * Math.sin(eps * (Math.PI / 180))) *
        (180 / Math.PI)
    );
}

describe('Makransky Sunshine (i)', () => {
    test('equator DEC=0: NSA=DSA=90° trisection is continuous in RAMC', () => {
        const lat = 0;
        const dec = 0;
        const armcA = 15;
        const armcB = 15.001;
        const ascA = computeAscendant(armcA, lat, EPS);
        const mcA = computeMC(armcA, EPS);
        const ascB = computeAscendant(armcB, lat, EPS);
        const mcB = computeMC(armcB, EPS);
        const a = makranskySunshineCusps(armcA, lat, EPS, ascA, mcA, dec);
        const b = makranskySunshineCusps(armcB, lat, EPS, ascB, mcB, dec);
        const maxJump = Math.max(
            ...a.map((v, i) => (Math.abs(((v - b[i] + 180) % 360) + 360) % 360) - 180),
        );
        expect(maxJump).toBeLessThan(0.05);
    });

    test('matches Treindl APC when min(DSA,NSA) ≥ 45°', () => {
        let checked = 0;
        for (let armc = 0; armc < 360; armc += 11) {
            for (const lat of [35, -42, 51.5]) {
                for (const sunLon of [30, 120, 200, 300]) {
                    const sunDec = sunDeclFromLon(sunLon, EPS);
                    if (sunshineMakranskyLongArcWedge(lat, sunDec)) continue;
                    if (makranskySunCircumpolar(lat, sunDec)) continue;
                    const asc = computeAscendant(armc, lat, EPS);
                    const mc = computeMC(armc, EPS);
                    const mak = makranskySunshineCusps(armc, lat, EPS, asc, mc, sunDec);
                    const treindl = treindlSunshineCusps(armc, lat, EPS, asc, mc, sunDec);
                    let max = 0;
                    for (let i = 0; i < 12; i++) {
                        const d = Math.abs(
                            ((((treindl[i] - mak[i] + 180) % 360) + 360) % 360) - 180,
                        );
                        max = Math.max(max, d);
                    }
                    expect(max).toBeLessThan(0.001);
                    checked++;
                }
            }
        }
        expect(checked).toBeGreaterThan(50);
    });

    test('wedge: Makransky differs from Treindl APC for high solar declination', () => {
        const lat = 55;
        const sunDec = 30;
        expect(sunshineMakranskyLongArcWedge(lat, sunDec)).toBe(true);
        const armc = 274;
        const asc = computeAscendant(armc, lat, EPS);
        const mc = computeMC(armc, EPS);
        const treindl = treindlSunshineCusps(armc, lat, EPS, asc, mc, sunDec);
        const mak = makranskySunshineCusps(armc, lat, EPS, asc, mc, sunDec);
        const max = Math.max(
            ...mak.map((v, i) => Math.abs(((((v - treindl[i] + 180) % 360) + 360) % 360) - 180)),
        );
        expect(max).toBeGreaterThan(0.01);
    });

    test('intermediate cusp 2 is stable under tiny offset perturbation', () => {
        const lon = makranskyIntermediateCusp(2, -40, 123.4, 40, 15, EPS);
        const lon2 = makranskyIntermediateCusp(2, -40.0001, 123.4, 40, 15, EPS);
        expect(Math.abs(lon - lon2)).toBeLessThan(0.01);
    });
});

describe('Polar latitude and pole clamp (coverage fixture)', () => {
    const highLats = [67.5, -67.5, 72, 80];

    test('at |lat| = 66.5° Placidus may still be defined (polar circle at 90° − ε)', () => {
        const lat = 66.5;
        const armc = 120;
        const asc = computeAscendant(armc, lat, EPS);
        const mc = computeMC(armc, EPS);
        const r = computeTropicalHouses('P', armc, lat, EPS, asc, mc, 0, {
            placidusScheme: 'converged',
            polarFallback: 'porphyry',
        });
        expect(r.fallback?.code).not.toBe('POLAR_PORPHYRY');
    });

    test.each(highLats)('Placidus/Koch Porphyry fallback at lat=%p', (lat) => {
        const armc = 198.5;
        const asc = computeAscendant(armc, lat, EPS);
        const mc = computeMC(armc, EPS);
        for (const letter of ['P', 'K'] as const) {
            const r = computeTropicalHouses(letter, armc, lat, EPS, asc, mc, 0, {
                placidusScheme: 'converged',
                polarFallback: 'porphyry',
            });
            expect(r.fallback?.code).toBe('POLAR_PORPHYRY');
        }
    });

    test('Regiomontanus/Campanus/Porphyry compute without polar fallback', () => {
        const lat = 72;
        const armc = 45;
        const asc = computeAscendant(armc, lat, EPS);
        const mc = computeMC(armc, EPS);
        for (const letter of ['R', 'C', 'O', 'W'] as const) {
            const r = computeTropicalHouses(letter, armc, lat, EPS, asc, mc, 0, {
                placidusScheme: 'converged',
                polarFallback: 'porphyry',
            });
            expect(r.fallback?.code).not.toBe('POLAR_PORPHYRY');
            expect(r.cusps).toHaveLength(12);
        }
    });

    test('pole clamp keeps co-latitude ascendant finite at the equator vertex', () => {
        const eps = 23.44;
        const armc = 77.25;
        expect(Number.isFinite(computeAscendant(armc, -89.999999, eps))).toBe(true);
        expect(Number.isFinite(computeVertex(armc, 0, eps))).toBe(true);
        const v = computeVertex(armc, 0, eps);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(360);
    });

    test('computeAscendant uses clamp below |lat| > 90 − ε', () => {
        const eps = 23.44;
        const lat = 89.999999;
        const armc = 100;
        const asc = computeAscendant(armc, lat, eps);
        expect(Number.isFinite(asc)).toBe(true);
        expect(asc).toBeGreaterThanOrEqual(0);
        expect(asc).toBeLessThan(360);
    });
});
