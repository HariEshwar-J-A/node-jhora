import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
    describeCalculation,
    EphemerisEngine,
    type PrecisionOptions,
    type SettingsInput,
} from '@node-jhora/core';
import { ChartSession } from '../src/chart-session.js';
import {
    combinedBenchFingerprint,
    DASHA_IDENTITY_CORPUS,
    dashaTreeSha256,
    f64Hex,
    housesFingerprintHex,
    planetsFingerprintHex,
} from '@node-jhora/testkit';
import { DateTime } from 'luxon';

/** Chennai bench instant (matches packages/bench chart fixture). */
const BENCH_INSTANT = DateTime.fromISO('2000-01-01T12:00:00', { zone: 'Asia/Kolkata' });
const BENCH_LOCATION = { latitude: 13.0827, longitude: 80.2707 };
const BENCH_JD_UT = 2_451_153.661_805_555_7;

type BenchProfileId = 'jhora' | 'modern' | 'truth';

const BENCH_PROFILES: { id: BenchProfileId; settings: SettingsInput }[] = [
    { id: 'jhora', settings: 'node-jhora-default' },
    { id: 'modern', settings: { preset: 'node-jhora-default', precisionProfile: 'modern' } },
    { id: 'truth', settings: { preset: 'node-jhora-default', precisionProfile: 'truth' } },
];

interface IdentityGoldens {
    schemaVersion: number;
    benchChart: Record<
        BenchProfileId,
        {
            ayanamsaHex: string;
            planetsHex: string;
            housesHex: string;
            dashaSha256: string;
            combinedSha256: string;
        }
    >;
    dashaTreeSha256: Record<string, string>;
}

const goldens = JSON.parse(
    readFileSync(join(import.meta.dirname, 'fixtures/server-grade-pr2-identity.json'), 'utf8'),
) as IdentityGoldens;

function precisionOpts(
    profile: BenchProfileId,
    resolved: ReturnType<typeof describeCalculation>,
): PrecisionOptions {
    const o: PrecisionOptions = {
        calendar: resolved.config.calendar,
        precisionProfile: profile === 'jhora' ? 'jhora' : profile,
    };
    if (resolved.config.deltaTOverrideSeconds !== undefined) {
        o.deltaTOverrideSeconds = resolved.config.deltaTOverrideSeconds;
    }
    if (resolved.config.deltaTForecast === 'oracle-compat') {
        o.deltaTForecast = resolved.config.deltaTForecast;
    }
    return o;
}

describe('server-grade PR2 output identity', () => {
    let engine: EphemerisEngine;

    beforeAll(async () => {
        engine = EphemerisEngine.getInstance();
        await engine.initialize();
    }, 120_000);

    test('bench chart IEEE hex + dasha SHA-256 unchanged (jhora, modern, truth)', () => {
        for (const profile of BENCH_PROFILES) {
            const resolved = describeCalculation(profile.settings);
            const session = new ChartSession({
                instant: BENCH_INSTANT,
                location: BENCH_LOCATION,
                settings: profile.settings,
                dasha: { depth: 5 },
                ephemeris: engine,
            });
            const snap = session.collect(['planets', 'houses', 'dasha']);
            const frame =
                profile.id === 'modern' || profile.id === 'truth' ? 'apparent' : 'geometric';
            const ayanamsa = engine.getAyanamsa(
                BENCH_JD_UT,
                resolved.config.ayanamsaMode,
                resolved.config.ayanamsaOffset,
                frame,
                precisionOpts(profile.id, resolved),
            );
            const planetsHex = planetsFingerprintHex(
                snap.planets!.map((p) => ({
                    name: p.name,
                    longitude: p.longitude,
                    latitude: p.latitude,
                    speed: p.speed,
                })),
            );
            const housesHex = housesFingerprintHex({
                ascendant: snap.houses!.ascendant,
                mc: snap.houses!.mc,
                cusps: snap.houses!.cusps,
            });
            const dashaSha = dashaTreeSha256(snap.dasha);
            const expected = goldens.benchChart[profile.id];
            expect(f64Hex(ayanamsa)).toBe(expected.ayanamsaHex);
            expect(planetsHex).toBe(expected.planetsHex);
            expect(housesHex).toBe(expected.housesHex);
            expect(dashaSha).toBe(expected.dashaSha256);
            expect(
                combinedBenchFingerprint({
                    ayanamsaHex: f64Hex(ayanamsa),
                    planetsHex,
                    housesHex,
                    dashaSha256: dashaSha,
                }),
            ).toBe(expected.combinedSha256);
        }
    });

    test('Vimshottari dasha tree SHA-256 (depth 5) for varied birth corpus', () => {
        expect(Object.keys(goldens.dashaTreeSha256).length).toBeGreaterThanOrEqual(20);
        for (const caseDef of DASHA_IDENTITY_CORPUS) {
            const instant = DateTime.fromISO(caseDef.instant, { zone: caseDef.timezone });
            expect(instant.isValid).toBe(true);
            const session = new ChartSession({
                instant,
                location: {
                    latitude: caseDef.latitude,
                    longitude: caseDef.longitude,
                    altitude: caseDef.altitude ?? 0,
                },
                settings: caseDef.settings,
                dasha: { depth: 5 },
                ephemeris: engine,
            });
            const dasha = session.getDasha();
            const hash = dashaTreeSha256(dasha);
            const expected = goldens.dashaTreeSha256[caseDef.id];
            expect(expected).toBeDefined();
            expect(hash).toBe(expected);
        }
    });
});
