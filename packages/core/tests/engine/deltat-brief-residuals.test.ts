/**
 * Residuals called out in the ΔT evidence brief (oracle fixtures).
 * Published-source engine vs test oracles — ceilings document honest gaps.
 */

import { readFileSync } from 'node:fs';
import { deltaT, decimalYear } from '../../src/engine/deltat.js';

const se210 = JSON.parse(
    readFileSync(new URL('../fixtures/deltat-pyswisseph-se210.json', import.meta.url), 'utf8'),
) as { samples: { y: number; jdUT: number; deltaTSeconds: number }[] };

const dll = JSON.parse(
    readFileSync(new URL('../fixtures/jhora_dll_golden.json', import.meta.url), 'utf8'),
) as { cases: { jdUT: number; deltaTSeconds: number }[] };

describe('modern 1952–1955 blend residuals', () => {
    test('1954.0 within 0.08 s of pyswisseph 2.10 (SMH2016→AA blend from 1953 knot)', () => {
        const s = se210.samples.find((x) => x.y === 1954)!;
        const err = Math.abs(deltaT(s.jdUT, 'modern', 'oracle-compat') - s.deltaTSeconds);
        expect(err).toBeLessThan(0.08);
    });
});

describe('jhora 2015–2019 table residuals (USNO obs vs SE 2.02 preds)', () => {
    test('max |ΔT| on DLL cases in 2015–2019 ≤ 0.35 s', () => {
        let max = 0;
        for (const c of dll.cases) {
            const y = decimalYear(c.jdUT);
            if (y < 2015 || y >= 2020) continue;
            max = Math.max(max, Math.abs(deltaT(c.jdUT) - c.deltaTSeconds));
        }
        expect(max).toBeLessThanOrEqual(0.35);
    });
});

describe('modern bridge vs pyswisseph 2.10 (USNO preds, not oracle)', () => {
    test('2027–2028 max residual ≤ 0.55 s', () => {
        let max = 0;
        for (const s of se210.samples) {
            if (s.y !== 2027 && s.y !== 2028) continue;
            max = Math.max(
                max,
                Math.abs(deltaT(s.jdUT, 'modern', 'oracle-compat') - s.deltaTSeconds),
            );
        }
        expect(max).toBeLessThanOrEqual(0.55);
    });
});
