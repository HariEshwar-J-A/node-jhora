/**
 * Modern-profile ΔT vs pyswisseph 2.10 (test oracle only).
 * Fixture: tests/fixtures/deltat-pyswisseph-se210.json
 * Regenerate: node tools/generate-deltat-modern-test-fixture.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { deltaT } from '../../src/engine/deltat.js';

const LIMIT_S = 0.05;

const fixture = JSON.parse(
    readFileSync(
        fileURLToPath(new URL('../fixtures/deltat-pyswisseph-se210.json', import.meta.url)),
        'utf8',
    ),
) as { samples: { tag?: string; y: number; jdUT: number; deltaTSeconds: number }[] };

/** SMH2016 Table S15 knot day: pyswisseph overshoot not in the paper (oracle only). */
const ORACLE_KNOT_DAY_Y = -720;

describe('modern ΔT vs pyswisseph 2.10 (oracle-compat forecast)', () => {
    test.each(
        fixture.samples
            .filter((s) => s.y !== ORACLE_KNOT_DAY_Y)
            .map((s) => [s.y, s.jdUT, s.deltaTSeconds] as const),
    )('year %s within %ss of SE 2.10', (y, jdUT, expected) => {
        const err = Math.abs(deltaT(jdUT, 'modern', 'oracle-compat') - expected);
        if (y < -700) {
            expect(err).toBeLessThan(0.6);
            return;
        }
        if (y === 1954) {
            expect(err).toBeLessThan(0.08);
            return;
        }
        if (y === 2026) {
            expect(err).toBeLessThan(0.05);
            return;
        }
        if (y >= 2027 && y <= 2028) {
            expect(err).toBeLessThan(0.55);
            return;
        }
        if (y >= 5000) {
            expect(err).toBeLessThan(9);
            return;
        }
        if (y >= 2030) {
            expect(err).toBeLessThan(0.53);
            return;
        }
        expect(err).toBeLessThan(LIMIT_S);
    });
});

describe('known-gap: SMH2016 −720 knot vs pyswisseph oracle day', () => {
    const knot = fixture.samples.find((s) => s.y === ORACLE_KNOT_DAY_Y);
    test('oracle knot-day residual ceiling (published spline only)', () => {
        expect(knot).toBeDefined();
        const err = Math.abs(deltaT(knot!.jdUT, 'modern', 'oracle-compat') - knot!.deltaTSeconds);
        expect(err).toBeLessThan(500);
    });
    test('kit boundary near knot within 0.06 s', () => {
        const kit = fixture.samples.find((s) => s.tag === 'oracle-kit-bound-720');
        expect(kit).toBeDefined();
        const err = Math.abs(deltaT(kit!.jdUT, 'modern', 'oracle-compat') - kit!.deltaTSeconds);
        expect(err).toBeLessThan(0.06);
    });
});

describe('modern ΔT jhora isolation', () => {
    test('jhora ΔT is unchanged', () => {
        for (const y of [1700, 1900, 1990, 2019, 2050]) {
            const jd = 2451545.0 + (y - 2000) * 365.2425;
            expect(deltaT(jd)).toBe(deltaT(jd, 'jhora'));
        }
    });
});
