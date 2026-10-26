/**
 * Placidus: the 'jhora' scheme must reproduce JHora's bundled SE 2.02.01 DLL
 * (swe_houses_armc, black-box probe in tests/fixtures/jhora_dll_placidus_probe.json)
 * at high latitudes, where the DLL's truncated iteration departs from the
 * converged cusp; 'converged' must agree with it where the truncation is
 * negligible.
 */

import { readFileSync } from 'node:fs';
import {
    computeAscendant,
    computeMC,
    placidusCusps,
    porphyryCusps,
} from '../../src/engine/coordinates.js';

interface ProbeCase {
    armc: number;
    lat: number;
    eps: number;
    ret: number;
    cusps: number[];
}
const probe = JSON.parse(
    readFileSync(new URL('../fixtures/jhora_dll_placidus_probe.json', import.meta.url), 'utf8'),
) as { cases: ProbeCase[] };

const gap = (a: number, b: number) => {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return Math.abs(d) * 3600;
};

describe('Placidus — JHora DLL scheme', () => {
    test('probe covers both the truncated regime and the polar fallback', () => {
        expect(probe.cases.filter((c) => c.ret === 0).length).toBeGreaterThanOrEqual(40);
        expect(probe.cases.some((c) => c.ret === -1)).toBe(true);
    });

    test.each(probe.cases)('armc $armc lat $lat eps $eps', (c) => {
        const asc = computeAscendant(c.armc, c.lat, c.eps);
        const mc = computeMC(c.armc, c.eps);
        const polar = Math.abs(c.lat) >= 90 - c.eps;
        expect(polar).toBe(c.ret === -1);
        const got = polar ? porphyryCusps(asc, mc) : placidusCusps(c.armc, c.lat, c.eps, asc, mc);
        const worst = Math.max(...got.map((v, i) => gap(v, c.cusps[i])));
        expect(worst).toBeLessThan(1e-3);
    });

    test("'converged' matches 'jhora' below 30° and departs from it at 64°", () => {
        let low = 0;
        let high = 0;
        for (let armc = 0.5; armc < 360; armc += 7.5) {
            for (const [lat, bucket] of [
                [28, 'low'],
                [-28, 'low'],
                [64, 'high'],
            ] as const) {
                const asc = computeAscendant(armc, lat, 23.44);
                const mc = computeMC(armc, 23.44);
                const a = placidusCusps(armc, lat, 23.44, asc, mc, 'jhora');
                const b = placidusCusps(armc, lat, 23.44, asc, mc, 'converged');
                const w = Math.max(...a.map((v, i) => gap(v, b[i])));
                if (bucket === 'low') low = Math.max(low, w);
                else high = Math.max(high, w);
            }
        }
        expect(low).toBeLessThan(1e-3);
        expect(high).toBeGreaterThan(1);
    });
});
