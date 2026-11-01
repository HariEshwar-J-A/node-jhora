/**
 * Modern geometric True Citra annual parallax (geocentre barycentric observer).
 * Urban & Seidelmann, Explanatory Supplement §7.2; ADR 0023.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { getAyanamsa, spicaForProfile, starLongitudeOfDate } from '../../src/engine/ayanamsa.js';
import { AU_KM } from '../../src/engine/apparent.js';
import { mod360 } from '../../src/engine/coordinates.js';
import { deltaT, withDeltaTContext } from '../../src/engine/deltat.js';
import {
    earthGeocenterBarycentricAu,
    earthGeocenterBarycentricAuAnalytic,
    setEarthBarycentricDeProvider,
} from '../../src/engine/earth-geocenter-barycentric.js';
import { VSOP87_EARTH_MAX_PARALLAX_MAS_VS_DE440 } from '../../src/engine/vsop87-earth.js';
import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { DE440S_JD_TDB_END, DE440S_JD_TDB_START } from '../../src/engine/provider/de440s.js';
import { NAIF } from '../../src/engine/spk.js';
import { jdUTtoET } from '../../src/engine/deltat.js';

const kernel = new Uint8Array(
    readFileSync(fileURLToPath(new URL('../../../ephe/de440s.bsp', import.meta.url))),
);

const GOLDEN_150_JD = 2464291.483634259;

function signedArcsec(a: number, b: number): number {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d * 3600;
}

function signedArcsecMas(a: number, b: number): number {
    return signedArcsec(a, b) * 1000;
}

function earthObserverAuDe440(jdUT: number): [number, number, number] {
    const eph = EphemerisEngine.getInstance() as EphemerisEngine & {
        source: { getBarycentric: (id: number, et: number) => { x: number; y: number; z: number } };
    };
    const earth = eph.source.getBarycentric(NAIF.Earth, jdUTtoET(jdUT));
    return [earth.x / AU_KM, earth.y / AU_KM, earth.z / AU_KM];
}

/** Pre-#322 main geometric True Citra (oracle-compat reference). */
function mainOracleCompatGeometricAyanamsa(jd: number): number {
    const star = spicaForProfile('modern');
    const jdTdb = jd + deltaT(jd, 'modern') / 86400.0;
    if (jdTdb >= DE440S_JD_TDB_START && jdTdb <= DE440S_JD_TDB_END) {
        const obs = earthObserverAuDe440(jd);
        return mod360(starLongitudeOfDate(star, jd, obs) - 180);
    }
    return mod360(starLongitudeOfDate(star, jd) - 180);
}

describe('modern geometric True Citra annual parallax', () => {
    beforeAll(async () => {
        await EphemerisEngine.getInstance().initialize({ kernel });
        setEarthBarycentricDeProvider({
            observerAU: (jdUT) => earthObserverAuDe440(jdUT),
        });
    });

    describe('starParallax oracle-compat (default)', () => {
        test('matches main geometric path at golden 150 and far outside kernel', () => {
            for (const jd of [GOLDEN_150_JD, DE440S_JD_TDB_START - 400, DE440S_JD_TDB_END + 400]) {
                const ref = mainOracleCompatGeometricAyanamsa(jd);
                const got = getAyanamsa(27, jd, 'geometric', 'modern');
                expect(Math.abs(signedArcsecMas(got, ref))).toBeLessThan(1e-6);
            }
        });

        test('raises geometric ayanamsa by ~7.988 mas at golden 150 (van Leeuwen π)', () => {
            const star = spicaForProfile('modern');
            const observer = earthObserverAuDe440(GOLDEN_150_JD);
            const lonBarycentric = starLongitudeOfDate(star, GOLDEN_150_JD);
            const lonGeocentric = starLongitudeOfDate(star, GOLDEN_150_JD, observer);
            const shiftFromStarLonArcsec = signedArcsec(lonGeocentric, lonBarycentric);
            expect(shiftFromStarLonArcsec).toBeCloseTo(0.007988, 3);
            const ayanGeo = getAyanamsa(27, GOLDEN_150_JD, 'geometric', 'modern');
            const ayanBary = mod360(lonBarycentric - 180);
            expect(signedArcsec(ayanGeo, ayanBary)).toBeCloseTo(shiftFromStarLonArcsec, 9);
        });

        test('jhora geometric True Citra stays barycentric (no observer offset)', () => {
            const star = spicaForProfile('jhora');
            const observer = earthObserverAuDe440(GOLDEN_150_JD);
            const ayanJhora = getAyanamsa(27, GOLDEN_150_JD, 'geometric', 'jhora');
            const lonCatalogue = starLongitudeOfDate(star, GOLDEN_150_JD);
            expect(signedArcsec(ayanJhora, mod360(lonCatalogue - 180))).toBeCloseTo(0, 9);
            const parallaxIfAppliedArcsec = signedArcsec(
                starLongitudeOfDate(star, GOLDEN_150_JD, observer),
                lonCatalogue,
            );
            expect(Math.abs(parallaxIfAppliedArcsec)).toBeGreaterThan(0.005);
        });

        test('apparent modern True Citra unchanged (already included parallax)', () => {
            const fixture = JSON.parse(
                readFileSync(
                    new URL('../fixtures/modern_se210_golden.json', import.meta.url),
                    'utf8',
                ),
            ) as { cases: { id: number; jdUT: number; ayanamsa: number }[] };
            const c = fixture.cases.find((x) => x.id === 150)!;
            const got = getAyanamsa(27, c.jdUT, 'apparent', 'modern');
            let d = (got - c.ayanamsa) % 360;
            if (d > 180) d -= 360;
            if (d < -180) d += 360;
            expect(Math.abs(d * 3600 * 1000)).toBeLessThan(3);
        });
    });

    describe("starParallax 'continuous'", () => {
        test('VSOP87 analytic matches DE440 parallax at kernel edges within 0.1 mas', () => {
            const star = spicaForProfile('modern');
            for (const jd of [DE440S_JD_TDB_START + 1, DE440S_JD_TDB_END - 1]) {
                const deObs = earthObserverAuDe440(jd);
                const vsopObs = earthGeocenterBarycentricAuAnalytic(jd);
                const lonBary = starLongitudeOfDate(star, jd);
                const piDe = signedArcsecMas(starLongitudeOfDate(star, jd, deObs), lonBary);
                const piVsop = signedArcsecMas(starLongitudeOfDate(star, jd, vsopObs), lonBary);
                expect(Math.abs(piVsop - piDe)).toBeLessThan(0.1);
            }
        });

        test.each([
            ['start', DE440S_JD_TDB_START],
            ['end', DE440S_JD_TDB_END],
        ] as const)('continuity across DE440s %s edge below 0.1 mas step', (_label, edgeJd) => {
            withDeltaTContext({ profile: 'modern', starParallax: 'continuous' }, () => {
                const ayan = (jd: number) => getAyanamsa(27, jd, 'geometric', 'modern');
                const dailyMas = (jd: number) =>
                    signedArcsecMas(ayan(jd + 0.5), ayan(jd - 0.5)) / 1;
                const dIn = dailyMas(edgeJd + 10);
                const dOut = dailyMas(edgeJd - 10);
                const dAt = dailyMas(edgeJd);
                const slopeJumpMas = Math.abs(dAt - (dIn + dOut) / 2);
                expect(slopeJumpMas).toBeLessThan(0.1);
            });
        });

        test('applies VSOP parallax far outside DE440s', () => {
            const jd = DE440S_JD_TDB_START - 400;
            withDeltaTContext({ profile: 'modern', starParallax: 'continuous' }, () => {
                const star = spicaForProfile('modern');
                const modern = getAyanamsa(27, jd, 'geometric', 'modern');
                const baryAyan = mod360(starLongitudeOfDate(star, jd) - 180);
                expect(Math.abs(signedArcsecMas(modern, baryAyan))).toBeGreaterThan(1);
                expect(Number.isFinite(earthGeocenterBarycentricAu(jd)[0]!)).toBe(true);
            });
        });

        test('truncated VSOP stays within documented DE440 parallax budget (ADR 0023)', () => {
            expect(VSOP87_EARTH_MAX_PARALLAX_MAS_VS_DE440).toBeLessThan(0.001);
        });
    });
});
