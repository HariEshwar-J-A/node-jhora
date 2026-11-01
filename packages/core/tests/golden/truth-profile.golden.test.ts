import { readFileSync } from 'node:fs';
import { DateTime } from 'luxon';
import { AYANAMSA } from '../../src/engine/ephemeris.js';
import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { getAyanamsa } from '../../src/engine/ayanamsa.js';
import { getGAST } from '../../src/engine/coordinates.js';
import { withDeltaTContext } from '../../src/engine/deltat.js';
import { parseEopBin } from '../../../eop/index.mjs';

const FIXTURE = JSON.parse(
    readFileSync(new URL('../fixtures/truth_profile_erfa.json', import.meta.url), 'utf8'),
) as {
    toleranceArcsec?: number;
    cases: {
        id: string;
        jdUt: number;
        deltaTSeconds: number;
        bodies: Record<string, { lon: number; lat: number }>;
        meanNodeDeg: number;
        trueNodeDeg: number;
        gastDeg: number;
        chennaiAscDeg?: number;
        chennaiMcDeg?: number;
        speedsDegPerDay?: Record<string, number>;
    }[];
};

const TOL_ARCSEC = FIXTURE.toleranceArcsec ?? 0.0001;
const SPEED_TOL_ARCSEC_PER_DAY = 0.001;

/** Vondrák join outside IAU 2006 core window (1600–2200 TT). */
const JOIN_WINDOW_JD_TT_MIN = 2305448.0;
const JOIN_WINDOW_JD_TT_MAX = 2524594.0;

function deltaArcsec(a: number, b: number): number {
    let d = a - b;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return Math.abs(d * 3600);
}

const CHENNAI = { lat: 13.0827, lon: 80.2707 };

let engine: EphemerisEngine;

beforeAll(async () => {
    const eopBytes = readFileSync(new URL('../../../eop/eop.bin', import.meta.url));
    engine = EphemerisEngine.getInstance();
    engine.setIersEopTable(parseEopBin(eopBytes));
    await engine.initialize();
}, 60_000);

describe('truth precision profile (ERFA fixture)', () => {
    for (const c of FIXTURE.cases) {
        test(`case ${c.id}`, () => {
            const utc = DateTime.fromMillis((c.jdUt - 2440587.5) * 86400000, { zone: 'utc' });
            const opts = {
                precisionProfile: 'truth' as const,
                deltaTOverrideSeconds: c.deltaTSeconds,
                zodiac: 'tropical' as const,
                positionMode: 'apparent' as const,
                includeOuterPlanets: true,
                nodeType: 'true' as const,
                julianDayUt: c.jdUt,
            };

            const jdTT = c.jdUt + c.deltaTSeconds / 86400;
            const inJoin = jdTT >= JOIN_WINDOW_JD_TT_MIN && jdTT <= JOIN_WINDOW_JD_TT_MAX;
            const lonTol = inJoin ? TOL_ARCSEC : 5.0;
            const latTol = inJoin ? TOL_ARCSEC : 0.1;
            const nodeTol = inJoin ? TOL_ARCSEC : 0.45;

            const planets = engine.getPlanets(utc, undefined, opts);
            for (const [name, exp] of Object.entries(c.bodies)) {
                const got = planets.find((p) => p.name === name);
                expect(got).toBeDefined();
                expect(deltaArcsec(got!.longitude, exp.lon)).toBeLessThanOrEqual(lonTol);
                expect(Math.abs((got!.latitude - exp.lat) * 3600)).toBeLessThanOrEqual(latTol);
            }

            if (c.speedsDegPerDay && inJoin) {
                for (const [name, expSpeed] of Object.entries(c.speedsDegPerDay)) {
                    const got = planets.find((p) => p.name === name);
                    expect(got).toBeDefined();
                    expect(Math.abs(got!.speed - expSpeed) * 3600).toBeLessThanOrEqual(
                        SPEED_TOL_ARCSEC_PER_DAY,
                    );
                }
            }

            const meanNode = engine
                .getPlanets(utc, undefined, { ...opts, nodeType: 'mean' })
                .find((p) => p.name === 'Rahu');
            expect(meanNode).toBeDefined();
            expect(deltaArcsec(meanNode!.longitude, c.meanNodeDeg)).toBeLessThanOrEqual(
                inJoin ? lonTol : 1.0,
            );

            const trueNode = planets.find((p) => p.name === 'Rahu');
            expect(trueNode).toBeDefined();
            expect(deltaArcsec(trueNode!.longitude, c.trueNodeDeg)).toBeLessThanOrEqual(nodeTol);

            const gast = withDeltaTContext(
                { profile: 'truth', overrideSeconds: c.deltaTSeconds },
                () => getGAST(c.jdUt, 'truth'),
            );
            expect(deltaArcsec(gast, c.gastDeg)).toBeLessThanOrEqual(inJoin ? TOL_ARCSEC : 8.0);

            if (inJoin && (c.chennaiAscDeg !== undefined || c.chennaiMcDeg !== undefined)) {
                const houses = engine.getHouses(
                    c.jdUt,
                    CHENNAI.lat,
                    CHENNAI.lon,
                    'W',
                    false,
                    undefined,
                    0,
                    undefined,
                    {
                        precisionProfile: 'truth',
                        deltaTOverrideSeconds: c.deltaTSeconds,
                    },
                );
                if (c.chennaiAscDeg !== undefined) {
                    expect(deltaArcsec(houses.ascendant, c.chennaiAscDeg)).toBeLessThanOrEqual(
                        TOL_ARCSEC,
                    );
                }
                if (c.chennaiMcDeg !== undefined) {
                    expect(deltaArcsec(houses.mc, c.chennaiMcDeg)).toBeLessThanOrEqual(TOL_ARCSEC);
                }
            }

            const citra = getAyanamsa(AYANAMSA.TRUE_CITRA, c.jdUt, 'geometric', 'truth');
            expect(Number.isFinite(citra)).toBe(true);
            const pushya = getAyanamsa(AYANAMSA.TRUE_PUSHYA, c.jdUt, 'geometric', 'truth');
            expect(Number.isFinite(pushya)).toBe(true);
        });
    }
});
