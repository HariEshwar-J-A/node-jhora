/**
 * 'modern' precision profile and deltaTOverrideSeconds: ΔT model, context
 * scoping, settings hashing and plumbing. Parity with Swiss Ephemeris 2.10 is
 * in tests/golden/modern-se210.golden.test.ts.
 */

import { DateTime } from 'luxon';
import {
    createResultEnvelope,
    DELTA_T_MODEL,
    DELTA_T_MODEL_MODERN,
    getPreset,
    hashSettings,
    LAST_OBSERVED_YEAR_MODERN,
    NodeJHora,
} from '../../src/index.js';
import { getGAST } from '../../src/engine/coordinates.js';
import {
    deltaT,
    getDeltaTContext,
    LAST_OBSERVED_YEAR,
    withDeltaTContext,
} from '../../src/engine/deltat.js';
import { OBSERVED_DELTAT_JAN1_MODERN_EXT } from '../../src/engine/deltat-observed.js';
import { SMH2016_S15 } from '../../src/engine/deltat-smh2016.js';
import { EphemerisEngine } from '../../src/engine/ephemeris.js';

/** JD (UT) of 1 January 0h of a Gregorian year that is a whole mean year from J2000. */
const jdOfYear = (y: number) => 2451545.0 + (y - 2000) * 365.2425;

describe('modern ΔT model', () => {
    test('observed record runs to 2026 for modern and stops at 2019 for jhora', () => {
        expect(LAST_OBSERVED_YEAR).toBe(2019);
        expect(LAST_OBSERVED_YEAR_MODERN).toBe(2026);
        // At whole years Bessel interpolation returns the tabulated value.
        OBSERVED_DELTAT_JAN1_MODERN_EXT.forEach((v, i) => {
            expect(deltaT(jdOfYear(2020 + i), 'modern')).toBeCloseTo(v, 9);
        });
    });

    test('before 1955 it is SMH2016 Table S15 plus the tidal correction to ṅ = −25.8', () => {
        // Knot 1900.0: a0 of the row starting there, + −0.000091·0.05·55².
        const row = SMH2016_S15.find((r) => r[0] === 1900)!;
        const tidal = -0.000091 * (-25.8 + 25.85) * (1900 - 1955) ** 2;
        expect(deltaT(jdOfYear(1900), 'modern')).toBeCloseTo(row[2] + tidal, 9);
        expect(SMH2016_S15).toHaveLength(54);
        expect(SMH2016_S15[0][0]).toBe(-720);
        expect(SMH2016_S15[53][1]).toBe(2016);
    });

    test('jhora ΔT is unchanged by the new profile', () => {
        for (const y of [1700, 1900, 1990, 2019, 2050, 2140]) {
            expect(deltaT(jdOfYear(y))).toBe(deltaT(jdOfYear(y), 'jhora'));
        }
    });

    test('after the record the extrapolation is continuous at 2026', () => {
        const a = deltaT(jdOfYear(LAST_OBSERVED_YEAR_MODERN) - 1e-6, 'modern');
        const b = deltaT(jdOfYear(LAST_OBSERVED_YEAR_MODERN) + 1e-6, 'modern');
        expect(Math.abs(a - b)).toBeLessThan(1e-3);
    });
});

describe('ΔT context and override', () => {
    test('override replaces ΔT inside the scope and is restored afterwards, even on throw', () => {
        const jd = jdOfYear(2100);
        const before = deltaT(jd);
        expect(withDeltaTContext({ overrideSeconds: 123.4 }, () => deltaT(jd))).toBe(123.4);
        expect(() =>
            withDeltaTContext({ profile: 'modern' }, () => {
                throw new Error('boom');
            }),
        ).toThrow('boom');
        expect(getDeltaTContext()).toEqual({ profile: 'jhora' });
        expect(deltaT(jd)).toBe(before);
    });

    test('nested scopes inherit the outer override and profile', () => {
        const jd = jdOfYear(2100);
        withDeltaTContext({ profile: 'modern' }, () => {
            expect(deltaT(jd)).toBe(deltaT(jd, 'modern'));
            withDeltaTContext({ overrideSeconds: 50 }, () => {
                expect(getDeltaTContext()).toEqual({ profile: 'modern', overrideSeconds: 50 });
            });
        });
    });

    test('the 2050 sidereal-time join does not depend on the ΔT prediction in force', () => {
        // Same ΔT at the chart instant under two profiles ⇒ the same sidereal time.
        const jd = jdOfYear(2100);
        const a = withDeltaTContext({ profile: 'jhora', overrideSeconds: 150 }, () => getGAST(jd));
        const b = withDeltaTContext({ profile: 'modern', overrideSeconds: 150 }, () => getGAST(jd));
        expect(a).toBe(b);
    });
});

describe('settings', () => {
    const base = getPreset('node-jhora-default');

    test("'modern' and deltaTOverrideSeconds are accepted and hashed", () => {
        const h0 = hashSettings(base);
        const hm = hashSettings({ ...base, precisionProfile: 'modern' });
        const ho = hashSettings({
            ...base,
            precisionProfile: 'modern',
            deltaTOverrideSeconds: 75.25,
        });
        const ho2 = hashSettings({
            ...base,
            precisionProfile: 'modern',
            deltaTOverrideSeconds: 75.26,
        });
        expect(new Set([h0, hm, ho, ho2]).size).toBe(4);
        // Omitted override leaves the hash exactly as before.
        expect(hashSettings({ ...base, deltaTOverrideSeconds: undefined })).toBe(h0);
    });

    test('unknown profiles and non-finite overrides are rejected', () => {
        expect(() => hashSettings({ ...base, precisionProfile: 'nasa' })).toThrow();
        expect(() => hashSettings({ ...base, deltaTOverrideSeconds: Number.NaN })).toThrow();
    });

    test('envelope names the ΔT model of the profile, or the pinned override', () => {
        expect(createResultEnvelope({ settingsHash: 'x' }).deltaTModel).toBe(DELTA_T_MODEL);
        expect(
            createResultEnvelope({ settingsHash: 'x', precisionProfile: 'modern' }).deltaTModel,
        ).toBe(DELTA_T_MODEL_MODERN);
        expect(
            createResultEnvelope({
                settingsHash: 'x',
                precisionProfile: 'modern',
                deltaTOverrideSeconds: 70,
            }).deltaTModel,
        ).toBe('override:70s');
    });
});

describe('plumbing through NodeJHora.calculate', () => {
    beforeAll(async () => {
        await EphemerisEngine.getInstance().initialize();
    }, 30_000);

    const date = new Date(Date.UTC(2100, 5, 1, 12));
    const loc = { latitude: 51.5, longitude: -0.12 };
    const base = getPreset('node-jhora-default');

    test('modern settings reach planets and houses; override changes the Moon', async () => {
        const engine = EphemerisEngine.getInstance();
        const jd = engine.julday(DateTime.fromJSDate(date));
        const jhora = await NodeJHora.calculate(date, loc, 'TrueChitra', {
            ...base,
            houseSystem: 'placidus',
        });
        const modern = await NodeJHora.calculate(date, loc, 'TrueChitra', {
            ...base,
            houseSystem: 'placidus',
            precisionProfile: 'modern',
        });
        const pinned = await NodeJHora.calculate(date, loc, 'TrueChitra', {
            ...base,
            houseSystem: 'placidus',
            precisionProfile: 'modern',
            deltaTOverrideSeconds: 200,
        });
        const expHouses = engine.getHouses(
            jd,
            loc.latitude,
            loc.longitude,
            'P',
            true,
            27,
            0,
            undefined,
            {
                precisionProfile: 'modern',
            },
        );
        expect(modern.houses.ascendant).toBeCloseTo(expHouses.ascendant, 12);
        expect(modern.houses.cusps).toEqual(expHouses.cusps);
        expect(modern.houses.ascendant).not.toBe(jhora.houses.ascendant);
        const moon = (r: typeof jhora) => r.planets.find((p) => p.name === 'Moon')!.longitude;
        expect(moon(pinned)).not.toBe(moon(modern));
        expect(new Set([jhora.settingsHash, modern.settingsHash, pinned.settingsHash]).size).toBe(
            3,
        );
    });
});
