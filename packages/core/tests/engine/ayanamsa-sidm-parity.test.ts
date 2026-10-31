/**
 * Every registered SE_SIDM mode must match pyswisseph 2.10 (apparent / modern profile)
 * and JHora DLL oracles (geometric) wherever the kit records them, across kernel-era JDs.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { AYANAMSA_MODELS, getAyanamsa, type AyanamsaFrame } from '../../src/engine/ayanamsa.js';
import { EphemerisEngine } from '../../src/engine/ephemeris.js';

const kernel = new Uint8Array(
    readFileSync(fileURLToPath(new URL('../../../ephe/de440s.bsp', import.meta.url))),
);

const fixture = JSON.parse(
    readFileSync(new URL('../fixtures/ayanamsa_sidm_parity_pins.json', import.meta.url), 'utf8'),
) as {
    kernelJds: number[];
    modern: Record<string, Record<string, number>>;
    jhora?: Record<string, Record<string, number>>;
};

const LIMIT_ARCSEC = 1;

function gapArcsec(a: number, b: number): number {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return Math.abs(d * 3600);
}

function modernFrame(mode: number): AyanamsaFrame {
    return AYANAMSA_MODELS[mode]?.kind === 'star' ? 'apparent' : 'apparent';
}

describe('Ayanamsa SIDM parity (modern + JHora oracles)', () => {
    beforeAll(async () => {
        await EphemerisEngine.getInstance().initialize({ kernel });
    });

    for (const modeStr of Object.keys(AYANAMSA_MODELS)) {
        const mode = Number(modeStr);
        const modernPins = fixture.modern[modeStr];
        if (!modernPins) {
            throw new Error(`fixture missing modern pins for registered mode ${modeStr}`);
        }

        describe(`mode ${modeStr} (${AYANAMSA_MODELS[mode].label})`, () => {
            for (const [jdStr, expected] of Object.entries(modernPins)) {
                const jd = Number(jdStr);
                test(`modern JD ${jdStr} within 1″ of pyswisseph 2.10`, () => {
                    expect(
                        gapArcsec(getAyanamsa(mode, jd, modernFrame(mode), 'modern'), expected),
                    ).toBeLessThan(LIMIT_ARCSEC);
                });
            }

            const jhoraPins = fixture.jhora?.[modeStr];
            if (jhoraPins) {
                for (const [jdStr, expected] of Object.entries(jhoraPins)) {
                    test(`jhora geometric JD ${jdStr} within 1″ of DLL oracle`, () => {
                        expect(
                            gapArcsec(
                                getAyanamsa(mode, Number(jdStr), 'geometric', 'jhora'),
                                expected,
                            ),
                        ).toBeLessThan(LIMIT_ARCSEC);
                    });
                }
            }
        });
    }
});
