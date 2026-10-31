/**
 * Jhora-profile ΔT vs JHora DLL golden (test oracle only).
 */

import { readFileSync } from 'node:fs';
import { deltaT, decimalYear, JHORA_TABLE_SWITCH_JD } from '../../src/engine/deltat.js';

const fixture = JSON.parse(
    readFileSync(new URL('../fixtures/jhora_dll_golden.json', import.meta.url), 'utf8'),
) as { cases: { jdUT: number; deltaTSeconds: number; utc: string }[] };

const LIMIT_HISTORIC_S = 0.01;
/** USNO observations 2016–2019 vs SE 2.02 USNO prediction table. */
const LIMIT_2015_2019_S = 0.35;
/** Stephenson (1997) fade vs SE 2.02 post-2019 predictions. */
const LIMIT_POST_2019_S = 0.28;

describe('jhora ΔT vs JHora DLL golden', () => {
    test.each(fixture.cases.map((c) => [c.utc, c.jdUT, c.deltaTSeconds] as const))(
        '%s',
        (_utc, jdUT, expected) => {
            const y = decimalYear(jdUT);
            const err = Math.abs(deltaT(jdUT) - expected);
            let limit = LIMIT_HISTORIC_S;
            if (y >= 2020) limit = LIMIT_POST_2019_S;
            else if (y >= 2015) limit = LIMIT_2015_2019_S;
            expect(err).toBeLessThan(limit);
        },
    );
});

describe('jhora table switch JD', () => {
    test('matches evidence brief boundary', () => {
        expect(JHORA_TABLE_SWITCH_JD).toBe(2317746.130902778);
    });
});
