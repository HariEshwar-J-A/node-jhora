import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
    AYANAMSA_MODELS,
    LAHIRI_ANCHOR_JD,
    LAHIRI_TRUE_AT_ANCHOR_DEG,
    getAyanamsa,
    meanAtAnchorForProfile,
    meanEquinoxLongitudeOnEclipticOf,
} from '../../src/engine/ayanamsa.js';
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

    test('each zero-at-anchor epoch model matches its anchor JD (modern)', () => {
        for (const [mode, model] of Object.entries(AYANAMSA_MODELS)) {
            if (model.kind !== 'epoch') continue;
            const mean = meanAtAnchorForProfile(model.meanAtAnchor, 'modern');
            if (Math.abs(mean) > 1e-6 && Math.abs(mean - 360) > 1e-6) continue;
            expect(getAyanamsa(Number(mode), model.jd, 'apparent', 'modern')).toBeCloseTo(0, 8);
        }
    });

    test('Lahiri mode 1 matches JHora DLL sample (ayanLahiriRaw, 1956)', () => {
        const jd = 2435805.5852083336;
        const jhoraLahiri = 23.255161653736;
        expect(
            gapArcsec(getAyanamsa(1, jd, 'geometric', 'jhora'), jhoraLahiri),
        ).toBeLessThanOrEqual(0.1);
    });

    test('Lahiri mode 1 matches pyswisseph 2.10 sample (modern profile)', () => {
        const jd = 2451758.1227777777;
        const modernLahiri = 23.86524318251344;
        expect(
            gapArcsec(getAyanamsa(1, jd, 'apparent', 'modern'), modernLahiri),
        ).toBeLessThanOrEqual(0.1);
    });

    describe('Lahiri mode 1 vs profile oracles (geometric jhora / apparent modern)', () => {
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

        test('mode 1 uses IAE 1956 anchor and traditional ecliptic-of-t0 propagation', () => {
            const model = AYANAMSA_MODELS[1];
            expect(model.kind).toBe('lahiri');
            if (model.kind === 'lahiri') {
                expect(model.jd).toBe(LAHIRI_ANCHOR_JD);
                expect(model.trueValue).toBeCloseTo(LAHIRI_TRUE_AT_ANCHOR_DEG, 12);
            }
            expect(
                meanEquinoxLongitudeOnEclipticOf(LAHIRI_ANCHOR_JD, LAHIRI_ANCHOR_JD),
            ).toBeCloseTo(0, 10);
        });

        test.each(epochs.filter((e) => e.jhoraOracle !== undefined))(
            'jhora geometric Lahiri at $label within 0.1″ of DLL oracle',
            ({ jd, jhoraOracle }) => {
                expect(
                    gapArcsec(getAyanamsa(1, jd, 'geometric', 'jhora'), jhoraOracle!),
                ).toBeLessThanOrEqual(0.1);
            },
        );

        test.each(epochs.filter((e) => e.modernOracle !== undefined))(
            'modern apparent Lahiri at $label within 0.1″ of pyswisseph oracle',
            ({ jd, modernOracle }) => {
                expect(
                    gapArcsec(getAyanamsa(1, jd, 'apparent', 'modern'), modernOracle!),
                ).toBeLessThanOrEqual(0.1);
            },
        );
    });
});
