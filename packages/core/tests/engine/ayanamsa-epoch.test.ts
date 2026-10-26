import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { AYANAMSA_MODELS, getAyanamsa } from '../../src/engine/ayanamsa.js';
import { EphemerisEngine } from '../../src/engine/ephemeris.js';

const kernel = new Uint8Array(
    readFileSync(fileURLToPath(new URL('../../../ephe/de440s.bsp', import.meta.url))),
);

function gapArcsec(a: number, b: number): number {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return Math.abs(d * 3600);
}

describe('Epoch-defined ayanamsa modes', () => {
    beforeAll(async () => {
        await EphemerisEngine.getInstance().initialize({ kernel });
    });

    test('each registered epoch model matches its anchor JD exactly', () => {
        for (const [mode, model] of Object.entries(AYANAMSA_MODELS)) {
            if (model.kind === 'epoch') {
                expect(getAyanamsa(Number(mode), model.jd)).toBeCloseTo(model.value, 12);
            }
        }
    });

    test('Lahiri mode 1 matches JHora DLL sample (ayanLahiriRaw, 1956)', () => {
        // Full-range sweep case id 163 (oracle_jhora.json); error was ~16.8″ before anchor fix.
        const jd = 2435805.5852083336;
        const jhoraLahiri = 23.255161653736;
        expect(gapArcsec(getAyanamsa(1, jd, 'geometric'), jhoraLahiri)).toBeLessThanOrEqual(0.1);
    });

    test('Lahiri mode 1 matches pyswisseph 2.10 sample (modern profile)', () => {
        // Full-range sweep case id 674 (oracle_modern.json, ayanLahiri).
        const jd = 2451758.1227777777;
        const modernLahiri = 23.86524318251344;
        expect(gapArcsec(getAyanamsa(1, jd, 'apparent'), modernLahiri)).toBeLessThanOrEqual(0.1);
    });

    describe('Lahiri mode 1 vs profile oracles (geometric jhora / apparent modern)', () => {
        const OLD_LAHIRI_JD = 2435553.5;
        const OLD_LAHIRI_VALUE = 23.250182;

        const epochs: { label: string; jd: number; jhoraOracle?: number; modernOracle?: number }[] =
            [
                { label: '1900-01-01', jd: 2415020.5 },
                {
                    label: '1956 sweep (DLL)',
                    jd: 2435805.5852083336,
                    jhoraOracle: 23.255161653736,
                },
                {
                    label: '2000-01-01',
                    jd: 2451545.0,
                },
                {
                    label: 'modern sweep',
                    jd: 2451758.1227777777,
                    modernOracle: 23.86524318251344,
                },
                { label: '2026-10-25', jd: 2460972.643310185 },
                { label: 'J2000 − 5000 yr', jd: 2451545.0 - 5000 * 365.25 },
                { label: 'J2000 + 5000 yr', jd: 2451545.0 + 5000 * 365.25 },
            ];

        test('mode 1 anchor matches published ICRC value at JD 2415020', () => {
            const model = AYANAMSA_MODELS[1];
            expect(model.kind).toBe('epoch');
            if (model.kind === 'epoch') {
                expect(model.jd).toBe(2415020.0);
                expect(model.value).toBeCloseTo(22 + 27 / 60 + 37.76 / 3600, 12);
            }
        });

        test.each(epochs.filter((e) => e.jhoraOracle !== undefined))(
            'jhora geometric Lahiri at $label within 0.1″ of DLL oracle',
            ({ jd, jhoraOracle }) => {
                expect(
                    gapArcsec(getAyanamsa(1, jd, 'geometric'), jhoraOracle!),
                ).toBeLessThanOrEqual(0.1);
            },
        );

        test.each(epochs.filter((e) => e.modernOracle !== undefined))(
            'modern apparent Lahiri at $label within 0.1″ of pyswisseph oracle',
            ({ jd, modernOracle }) => {
                expect(
                    gapArcsec(getAyanamsa(1, jd, 'apparent'), modernOracle!),
                ).toBeLessThanOrEqual(0.1);
            },
        );

        test('post-fix Lahiri is closer to jhora oracle than the old 1956-anchor mode 1', () => {
            const jd = 2435805.5852083336;
            const oracle = 23.255161653736;
            const errNew = gapArcsec(getAyanamsa(1, jd, 'geometric'), oracle);
            const propagatedOld =
                OLD_LAHIRI_VALUE +
                (getAyanamsa(1, jd, 'geometric') - getAyanamsa(1, OLD_LAHIRI_JD, 'geometric'));
            const errOld = gapArcsec(propagatedOld, oracle);
            expect(errNew).toBeLessThan(0.1);
            expect(errNew).toBeLessThan(errOld);
            expect(errOld).toBeGreaterThan(15);
        });
    });
});
