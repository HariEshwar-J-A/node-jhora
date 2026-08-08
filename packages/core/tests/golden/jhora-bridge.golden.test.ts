/**
 * JHora Bridge — parity with Jagannatha Hora.
 *
 * Validates the engine end-to-end against a real JHora natal chart export:
 * ayanamsa, D1 longitudes, ascendant, sidereal time, D9, panchanga and dasha.
 *
 * Astrometry is pinned separately and more strictly against JPL Horizons in
 * `horizons.golden.test.ts`. What this suite adds is JHora's *conventions* —
 * which sidereal zero point, which node, and whether positions are geometric or
 * apparent. Each of those is a discrete choice that no amount of astrometric
 * accuracy will get right by itself.
 */

import { DateTime }           from 'luxon';
import { EphemerisEngine }    from '../../src/engine/ephemeris.js';
import { getAyanamsa, AYANAMSA_MODELS, accumulatedPrecession } from '../../src/engine/ayanamsa.js';
import { calculatePanchanga } from '../../src/vedic/panchanga.js';
import { calculateVarga, DEFAULT_DASAMSA_SCHEME } from '../../src/vedic/vargas.js';
import {
    JHORA_BIRTH,
    JHORA_CONVENTIONS,
    JHORA_AYANAMSA,
    JHORA_D1,
    JHORA_D9,
    JHORA_D9_ASCENDANT,
    JHORA_ASCENDANT,
    JHORA_SIDEREAL_TIME,
    JHORA_PANCHANGA,
    JHORA_D10,
    JHORA_D10_ASCENDANT,
    JHORA_D10_SCHEME,
    JHORA_D10_LABEL,
    JHORA_D10_EVEN_SIGN_BODIES,
} from '../fixtures/jhora_golden.js';

let engine: EphemerisEngine;
let refJD:  number;
let planets: ReturnType<EphemerisEngine['getPlanets']>;
let ascendant: number;

const REF_UTC   = DateTime.fromObject(JHORA_BIRTH.utc, { zone: 'utc' });
const REF_LOCAL = REF_UTC.setZone('Asia/Kolkata');

beforeAll(async () => {
    engine = EphemerisEngine.getInstance();
    await engine.initialize();
    engine.setAyanamsa(JHORA_CONVENTIONS.ayanamsaMode);

    refJD     = engine.julday(REF_UTC);
    planets   = engine.getPlanets(REF_UTC);
    ascendant = engine.getHouses(refJD, JHORA_BIRTH.lat, JHORA_BIRTH.lon, 'W', true).ascendant;
}, 30_000);

/** |a − b| in arcseconds, wrapped across 0°/360°. */
function gapArcsec(a: number, b: number): number {
    let d = a - b;
    if (d >  180) d -= 360;
    if (d < -180) d += 360;
    return Math.abs(d) * 3600;
}

const bodyLon = (name: string) => planets.find(p => p.name === name)!.longitude;

// ===========================================================================
// 1. Conventions — the defaults must be JHora's, not astronomy's
// ===========================================================================

describe('JHora Bridge: engine defaults match JHora conventions', () => {
    test('Julian Day matches', () => {
        expect(Math.abs(refJD - JHORA_BIRTH.jd)).toBeLessThan(1e-6);
    });

    test('default ayanamsa is True Chitrapaksha, and it is star-defined', () => {
        expect(AYANAMSA_MODELS[JHORA_CONVENTIONS.ayanamsaMode].kind).toBe('star');
    });

    test('default positions are geometric, not apparent', () => {
        const geometric = engine.getPlanets(REF_UTC).find(p => p.name === 'Venus')!;
        const apparent  = engine.getPlanets(REF_UTC, undefined, { positionMode: 'apparent' })
            .find(p => p.name === 'Venus')!;

        // Venus is near conjunction here, so the two conventions are ~44″ apart —
        // the largest separation in the chart, and the clearest discriminator.
        expect(gapArcsec(geometric.longitude, apparent.longitude)).toBeGreaterThan(30);
        expect(gapArcsec(geometric.longitude, JHORA_D1.find(b => b.name === 'Venus')!.longitude))
            .toBeLessThan(1);
    });

    test('default node is the true node, not the mean node', () => {
        const jhoraRahu = JHORA_D1.find(b => b.name === 'Rahu')!.longitude;
        const mean = engine.getPlanets(REF_UTC, undefined, { nodeType: 'mean' })
            .find(p => p.name === 'Rahu')!;

        expect(gapArcsec(bodyLon('Rahu'), jhoraRahu)).toBeLessThan(2);
        // The mean node is nearly a degree away — an unmistakable discriminator.
        expect(gapArcsec(mean.longitude, jhoraRahu)).toBeGreaterThan(1800);
    });
});

// ===========================================================================
// 2. Ayanamsa
// ===========================================================================

describe('JHora Bridge: Ayanamsa', () => {
    test(`True Chitrapaksha = ${JHORA_AYANAMSA.printed} (±${JHORA_AYANAMSA.toleranceArcsec}″)`, () => {
        const actual = getAyanamsa(JHORA_AYANAMSA.mode, refJD);
        expect(gapArcsec(actual, JHORA_AYANAMSA.value))
            .toBeLessThanOrEqual(JHORA_AYANAMSA.toleranceArcsec);
    });

    test('is derived from Spica, with no fitted constant', () => {
        const model = AYANAMSA_MODELS[27];
        expect(model).toMatchObject({ kind: 'star', star: 'Spica', atLongitude: 180 });
    });

    test('ICRC Lahiri reproduces its definition: 23°15′00″ at 1956-03-21', () => {
        expect(getAyanamsa(1, 2435553.5)).toBeCloseTo(23.250182, 6);
    });

    test('advances at the general precession rate, ~50.3″/year', () => {
        const perYear = (getAyanamsa(27, 2451545.0 + 36525) - getAyanamsa(27, 2451545.0)) * 36;
        expect(perYear).toBeGreaterThan(50.0);
        expect(perYear).toBeLessThan(50.6);
    });

    test('accumulated precession is antisymmetric in its endpoints', () => {
        expect(accumulatedPrecession(2415020.5, 2460476.5)
             + accumulatedPrecession(2460476.5, 2415020.5)).toBeCloseTo(0, 6);
    });
});

// ===========================================================================
// 3. D1 Rasi
// ===========================================================================

describe('JHora Bridge: D1 Rasi', () => {
    for (const ref of JHORA_D1) {
        test(`${ref.name} = ${ref.printed.trim()} (±${ref.toleranceArcsec}″)`, () => {
            expect(Math.floor(bodyLon(ref.name) / 30) + 1).toBe(ref.sign);
            expect(gapArcsec(bodyLon(ref.name), ref.longitude))
                .toBeLessThanOrEqual(ref.toleranceArcsec);
        });
    }

    for (const ref of JHORA_D1.filter(b => b.retrograde)) {
        test(`${ref.name} is retrograde, as JHora marks with (R)`, () => {
            expect(planets.find(p => p.name === ref.name)!.speed).toBeLessThan(0);
        });
    }

    test('bodies JHora leaves unmarked are direct', () => {
        for (const ref of JHORA_D1.filter(b => !b.retrograde && b.name !== 'Rahu' && b.name !== 'Ketu')) {
            expect(planets.find(p => p.name === ref.name)!.speed).toBeGreaterThan(0);
        }
    });

    test('Ketu is exactly opposite Rahu', () => {
        expect(gapArcsec(bodyLon('Rahu') + 180, bodyLon('Ketu'))).toBeLessThan(1e-6);
    });
});

// ===========================================================================
// 4. Ascendant & sidereal time
// ===========================================================================

describe('JHora Bridge: Ascendant and sidereal time', () => {
    test(`Lagna = ${JHORA_ASCENDANT.printed} (±${JHORA_ASCENDANT.toleranceArcsec}″)`, () => {
        expect(Math.floor(ascendant / 30) + 1).toBe(JHORA_ASCENDANT.sign);
        expect(gapArcsec(ascendant, JHORA_ASCENDANT.longitude))
            .toBeLessThanOrEqual(JHORA_ASCENDANT.toleranceArcsec);
    });

    test(`local sidereal time = ${JHORA_SIDEREAL_TIME.printed} (±${JHORA_SIDEREAL_TIME.toleranceSeconds}s)`, () => {
        // JHora prints local apparent sidereal time; the engine returns Greenwich.
        const local = (engine.getSiderealTime(refJD) + JHORA_BIRTH.lon / 15 + 24) % 24;
        expect(Math.abs(local - JHORA_SIDEREAL_TIME.hours) * 3600)
            .toBeLessThanOrEqual(JHORA_SIDEREAL_TIME.toleranceSeconds);
    });

    test('Whole-Sign cusps start at 0° of the ascendant sign', () => {
        const h = engine.getHouses(refJD, JHORA_BIRTH.lat, JHORA_BIRTH.lon, 'W', true);
        expect(h.cusps[0]).toBe(Math.floor(h.ascendant / 30) * 30);
        expect(h.cusps).toHaveLength(12);
    });

    /** Guards the two-argument ascendant formula across hemispheres and latitudes. */
    test.each([
        ['Chennai',    13.0833,  80.2833],
        ['Sydney',    -33.8688, 151.2093],
        ['Reykjavík',  64.1466, -21.9426],
        ['Quito',      -0.1807, -78.4678],
    ])('ascendant leads the MC by 0°–180° at %s', (_city, lat, lonDeg) => {
        for (let hour = 0; hour < 24; hour++) {
            const jd = engine.julday(
                DateTime.fromObject({ year: 2024, month: 3, day: 20, hour }, { zone: 'utc' }),
            );
            const h = engine.getHouses(jd, lat, lonDeg, 'W', false);
            const lead = ((h.ascendant - h.mc) % 360 + 360) % 360;
            expect(lead).toBeGreaterThan(0);
            expect(lead).toBeLessThan(180);
        }
    });
});

// ===========================================================================
// 5. D9 Navamsa
// ===========================================================================

describe('JHora Bridge: D9 Navamsa', () => {
    const d9 = (l: number) => {
        const v = calculateVarga(l, 9);
        return (v.sign - 1) * 30 + v.degree;
    };

    for (const ref of JHORA_D9) {
        test(`${ref.name} = ${ref.printed.trim()} (±${ref.toleranceArcsec}″)`, () => {
            const got = d9(bodyLon(ref.name));
            expect(Math.floor(got / 30) + 1).toBe(ref.sign);
            expect(gapArcsec(got, ref.longitude)).toBeLessThanOrEqual(ref.toleranceArcsec);
        });
    }

    test(`Lagna = ${JHORA_D9_ASCENDANT.printed}`, () => {
        const got = d9(ascendant);
        expect(Math.floor(got / 30) + 1).toBe(JHORA_D9_ASCENDANT.sign);
        expect(gapArcsec(got, JHORA_D9_ASCENDANT.longitude))
            .toBeLessThanOrEqual(JHORA_D9_ASCENDANT.toleranceArcsec);
    });
});

// ===========================================================================
// 6. D10 Dasamsa — JHora's "(5-8)" scheme, and the toggle
// ===========================================================================

describe(`JHora Bridge: D10 Dasamsa (${JHORA_D10_LABEL})`, () => {
    // JHora's D10 variant is not the BPHS rule, so the library default is
    // 'parashara'. Reproducing JHora therefore requires asking for it.
    const d10 = (l: number, scheme: 'parashara' | 'jhora_5_8' = JHORA_D10_SCHEME) => {
        const v = calculateVarga(l, 10, { dasamsaScheme: scheme });
        return (v.sign - 1) * 30 + v.degree;
    };

    test("the library default is classical Parashara, not JHora's variant", () => {
        expect(DEFAULT_DASAMSA_SCHEME).toBe('parashara');
        expect(JHORA_D10_SCHEME).toBe('jhora_5_8');
    });

    for (const ref of JHORA_D10) {
        test(`${ref.name} = ${ref.printed.trim()} (±${ref.toleranceArcsec}″)`, () => {
            const got = d10(bodyLon(ref.name));
            expect(Math.floor(got / 30) + 1).toBe(ref.sign);
            expect(gapArcsec(got, ref.longitude)).toBeLessThanOrEqual(ref.toleranceArcsec);
        });
    }

    test(`Lagna = ${JHORA_D10_ASCENDANT.printed}`, () => {
        const got = d10(ascendant);
        expect(Math.floor(got / 30) + 1).toBe(JHORA_D10_ASCENDANT.sign);
        expect(gapArcsec(got, JHORA_D10_ASCENDANT.longitude))
            .toBeLessThanOrEqual(JHORA_D10_ASCENDANT.toleranceArcsec);
    });

    // ── The toggle must actually change something, in the right places ──────

    test('odd-sign bodies are identical under both schemes', () => {
        const oddSignBodies = JHORA_D10
            .map(b => b.name)
            .filter(n => !(JHORA_D10_EVEN_SIGN_BODIES as readonly string[]).includes(n));

        expect(oddSignBodies.length).toBeGreaterThan(0);
        for (const name of oddSignBodies) {
            expect(d10(bodyLon(name), 'parashara'))
                .toBeCloseTo(d10(bodyLon(name), 'jhora_5_8'), 9);
        }
    });

    test('even-sign bodies differ between the schemes, and only JHora\'s matches', () => {
        for (const name of JHORA_D10_EVEN_SIGN_BODIES) {
            const ref = JHORA_D10.find(b => b.name === name)!;

            expect(gapArcsec(d10(bodyLon(name), 'jhora_5_8'), ref.longitude))
                .toBeLessThanOrEqual(ref.toleranceArcsec);
            // Parashara puts these in a different sign entirely.
            expect(gapArcsec(d10(bodyLon(name), 'parashara'), ref.longitude))
                .toBeGreaterThan(3600);
        }
    });

    test('the reversal is exact: Parashara degree + JHora degree = 30° in even signs', () => {
        for (const name of JHORA_D10_EVEN_SIGN_BODIES) {
            const p = calculateVarga(bodyLon(name), 10, { dasamsaScheme: 'parashara' });
            const j = calculateVarga(bodyLon(name), 10, { dasamsaScheme: 'jhora_5_8' });
            expect(p.degree + j.degree).toBeCloseTo(30, 9);
        }
    });

    test('Parashara mode follows BPHS: even signs count forward from the 9th sign', () => {
        // Sun sits at 19°59′ Scorpio (sign 8, even). Ninth from Scorpio is
        // Cancer; the 7th of its ten parts lands in Capricorn.
        const v = calculateVarga(bodyLon('Sun'), 10, { dasamsaScheme: 'parashara' });
        expect(v.sign).toBe(10);
    });

    test('every other varga is unaffected by the scheme', () => {
        for (const division of [1, 2, 3, 4, 7, 9, 12, 16, 20, 24, 27, 30, 40, 45, 60]) {
            const a = calculateVarga(bodyLon('Sun'), division, { dasamsaScheme: 'parashara' });
            const b = calculateVarga(bodyLon('Sun'), division, { dasamsaScheme: 'jhora_5_8' });
            expect(a.longitude).toBeCloseTo(b.longitude, 9);
        }
    });

    test('both schemes stay in range across the whole zodiac', () => {
        for (const scheme of ['parashara', 'jhora_5_8'] as const) {
            for (let l = 0; l < 360; l += 0.37) {
                const v = calculateVarga(l, 10, { dasamsaScheme: scheme });
                expect(v.sign).toBeGreaterThanOrEqual(1);
                expect(v.sign).toBeLessThanOrEqual(12);
                expect(v.degree).toBeGreaterThanOrEqual(0);
                expect(v.degree).toBeLessThan(30);
                expect(v.longitude).toBeGreaterThanOrEqual(0);
                expect(v.longitude).toBeLessThan(360);
            }
        }
    });
});

// ===========================================================================
// 7. Panchanga
// ===========================================================================

describe('JHora Bridge: Panchanga', () => {
    let pa: ReturnType<typeof calculatePanchanga>;

    beforeAll(() => {
        pa = calculatePanchanga(bodyLon('Sun'), bodyLon('Moon'), REF_LOCAL);
    });

    const tol = JHORA_PANCHANGA.tolerancePercent;

    test(`Tithi = ${JHORA_PANCHANGA.tithi.name} (${JHORA_PANCHANGA.tithi.percentLeft}% left)`, () => {
        expect(pa.tithi.index).toBe(JHORA_PANCHANGA.tithi.index);
        // JHora prints what remains; the engine reports what has elapsed.
        expect(100 - pa.tithi.percent).toBeCloseTo(JHORA_PANCHANGA.tithi.percentLeft, 1);
        expect(Math.abs((100 - pa.tithi.percent) - JHORA_PANCHANGA.tithi.percentLeft)).toBeLessThan(tol);
    });

    test(`Nakshatra = ${JHORA_PANCHANGA.nakshatra.name} pada ${JHORA_PANCHANGA.nakshatra.pada} (${JHORA_PANCHANGA.nakshatra.percentLeft}% left)`, () => {
        expect(pa.nakshatra.name).toBe(JHORA_PANCHANGA.nakshatra.name);
        expect(pa.nakshatra.index).toBe(JHORA_PANCHANGA.nakshatra.index);
        expect(pa.nakshatra.pada).toBe(JHORA_PANCHANGA.nakshatra.pada);
        expect(Math.abs((100 - pa.nakshatra.percent) - JHORA_PANCHANGA.nakshatra.percentLeft)).toBeLessThan(tol);
    });

    test(`Yoga = ${JHORA_PANCHANGA.yoga.name}`, () => {
        // JHora spells it "Sukla", the engine "Shukla".
        expect(pa.yoga.name.replace('h', '')).toBe(JHORA_PANCHANGA.yoga.name);
    });

    test(`Karana = ${JHORA_PANCHANGA.karana.name}`, () => {
        expect(pa.karana.name).toBe(JHORA_PANCHANGA.karana.name);
    });

    test(`Vara = ${JHORA_PANCHANGA.vara.name}`, () => {
        expect(pa.vara.index).toBe(JHORA_PANCHANGA.vara.index);
    });
});
