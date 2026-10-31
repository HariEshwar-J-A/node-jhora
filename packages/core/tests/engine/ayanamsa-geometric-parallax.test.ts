/**
 * Modern geometric True Citra includes annual parallax (geocentre barycentric
 * observer). Urban & Seidelmann, Explanatory Supplement §7.2; van Leeuwen 2007
 * A&A 474, 653 (Spica parallax 13.06 mas).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { getAyanamsa, spicaForProfile, starLongitudeOfDate } from '../../src/engine/ayanamsa.js';
import { AU_KM } from '../../src/engine/apparent.js';
import { mod360 } from '../../src/engine/coordinates.js';
import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { NAIF } from '../../src/engine/spk.js';
import { jdUTtoET } from '../../src/engine/deltat.js';

const kernel = new Uint8Array(
    readFileSync(fileURLToPath(new URL('../../../ephe/de440s.bsp', import.meta.url))),
);

/** Golden case 150 — 2034-11-24T23:36:26Z (brief decomposition). */
const GOLDEN_150_JD = 2464291.483634259;

function signedArcsec(a: number, b: number): number {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d * 3600;
}

function earthObserverAuIcrf(jdUT: number): [number, number, number] {
    const eph = EphemerisEngine.getInstance() as EphemerisEngine & {
        source: { getBarycentric: (id: number, et: number) => { x: number; y: number; z: number } };
    };
    const earth = eph.source.getBarycentric(NAIF.Earth, jdUTtoET(jdUT));
    return [earth.x / AU_KM, earth.y / AU_KM, earth.z / AU_KM];
}

describe('modern geometric True Citra annual parallax', () => {
    beforeAll(async () => {
        await EphemerisEngine.getInstance().initialize({ kernel });
    });

    test('raises geometric ayanamsa by ~7.988 mas at golden 150 (van Leeuwen π)', () => {
        const star = spicaForProfile('modern');
        const observer = earthObserverAuIcrf(GOLDEN_150_JD);
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
        const observer = earthObserverAuIcrf(GOLDEN_150_JD);
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
            readFileSync(new URL('../fixtures/modern_se210_golden.json', import.meta.url), 'utf8'),
        ) as { cases: { id: number; jdUT: number; ayanamsa: number }[] };
        const c = fixture.cases.find((x) => x.id === 150)!;
        const got = getAyanamsa(27, c.jdUT, 'apparent', 'modern');
        let d = (got - c.ayanamsa) % 360;
        if (d > 180) d -= 360;
        if (d < -180) d += 360;
        expect(Math.abs(d * 3600 * 1000)).toBeLessThan(3);
    });
});
