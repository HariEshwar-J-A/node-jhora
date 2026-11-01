import { gast06aDegrees, s06Radians } from '../../src/engine/gst-erfa.js';

/** Cross-check vs pyerfa 2.0.1.5 gst06a / s06 (geocentre, J2000 split). */
const PYERFA_GAST_DEG = [
    { jdUt1: 2451545.0, jdTT: 2451545.0, deg: 280.457_072_333_085_25 },
    { jdUt1: 2506352.0, jdTT: 2506352.0 + 67 / 86400, deg: 300.832_554_966_809_65 },
    { jdUt1: 2458863.5, jdTT: 2458863.5 + 69.184 / 86400, deg: 113.916_807_774_707_79 },
];

describe('ERFA gst06a (truth GAST)', () => {
    for (const { jdUt1, jdTT, deg } of PYERFA_GAST_DEG) {
        test(`matches pyerfa at UT1 ${jdUt1}`, () => {
            const got = gast06aDegrees(jdUt1, jdTT);
            let d = got - deg;
            if (d > 180) d -= 360;
            if (d < -180) d += 360;
            expect(Math.abs(d * 3600)).toBeLessThan(1e-5);
        });
    }

    test('s06 at J2000 CIP matches pyerfa', () => {
        const x = -2.694_638_014_904_722e-5;
        const y = -2.800_472_116_476_493_4e-5;
        expect(s06Radians(2451545, 0, x, y)).toBeCloseTo(-1.013_396_517_756_380_3e-8, 15);
    });
});
