// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DateTime } from 'luxon';
import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import {
    getAyanamsa,
    AYANAMSA_MODELS,
    LAHIRI_ANCHOR_JD,
    accumulatedPrecession,
    trueAyanamsaFromModel,
} from '../../src/engine/ayanamsa.js';
import { calculatePanchanga } from '../../src/vedic/panchanga.js';
import { calculateVarga, DEFAULT_DASAMSA_SCHEME } from '../../src/vedic/vargas.js';
import {
    JHORA_BIRTH,
    JHORA_CHARTS,
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
    type JhoraChartCase,
} from '../fixtures/jhora_golden.js';

const chunk441Dir =
    process.env.NJCE441_DIR ?? fileURLToPath(new URL('../../../ephe441/dist', import.meta.url));

function haveDe441Chunks(): boolean {
    if (!existsSync(chunk441Dir)) return false;
    return readdirSync(chunk441Dir).some((n) => n.startsWith('g0-c') && n.endsWith('.njce'));
}

const haveDe441 = haveDe441Chunks();

let engine: EphemerisEngine;

beforeAll(async () => {
    engine = EphemerisEngine.getInstance();
    await engine.initialize();
    engine.setAyanamsa(JHORA_CONVENTIONS.ayanamsaMode);
    if (haveDe441) {
        engine.setEphemerisPolicy('de441_long');
    }
}, 30_000);

/** |a − b| in arcseconds, wrapped across 0°/360°. */
function gapArcsec(a: number, b: number): number {
    let d = a - b;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return Math.abs(d) * 3600;
}

function chartUtc(chart: JhoraChartCase) {
    return DateTime.fromObject(chart.utc, { zone: 'utc' });
}

function runChart(chart: JhoraChartCase) {
    const utc = chartUtc(chart);
    const refJD = engine.julday(utc);
    const planets = engine.getPlanets(utc);
    const ascendant = engine.getHouses(refJD, chart.lat, chart.lon, 'W', true).ascendant;
    const bodyLon = (name: string) => planets.find((p) => p.name === name)!.longitude;
    return { utc, refJD, planets, ascendant, bodyLon };
}

// ===========================================================================
// Twelve-chart JHora D1 + ayanamsa (screen-transcribed oracles)
// ===========================================================================

describe('JHora Bridge: twelve-chart D1 corpus', () => {
    for (const chart of JHORA_CHARTS) {
        const suite = chart.needsDe441 && !haveDe441 ? describe.skip : describe;
        suite(chart.id, () => {
            let ctx: ReturnType<typeof runChart>;

            beforeAll(() => {
                ctx = runChart(chart);
            });

            test('Julian Day matches manifest', () => {
                expect(Math.abs(ctx.refJD - chart.jd)).toBeLessThan(1e-5);
            });

            test(`ayanamsa ${chart.ayanamsa.printed}`, () => {
                const actual = getAyanamsa(27, ctx.refJD);
                expect(gapArcsec(actual, chart.ayanamsa.value)).toBeLessThanOrEqual(
                    chart.ayanamsa.toleranceArcsec,
                );
            });

            test(`Lagna ${chart.ascendant.printed.trim()}`, () => {
                expect(Math.floor(ctx.ascendant / 30) + 1).toBe(chart.ascendant.sign);
                expect(gapArcsec(ctx.ascendant, chart.ascendant.longitude)).toBeLessThanOrEqual(
                    chart.ascendant.toleranceArcsec,
                );
            });

            for (const ref of chart.d1) {
                test(`${ref.name} ${ref.printed.trim()}`, () => {
                    expect(Math.floor(ctx.bodyLon(ref.name) / 30) + 1).toBe(ref.sign);
                    expect(gapArcsec(ctx.bodyLon(ref.name), ref.longitude)).toBeLessThanOrEqual(
                        ref.toleranceArcsec,
                    );
                });
            }
        });
    }
});

// ===========================================================================
// Reference chart (Greenwich J2000) — conventions, vargas, panchanga
// ===========================================================================

let refJD: number;
let planets: ReturnType<EphemerisEngine['getPlanets']>;
let ascendant: number;

const REF_UTC = DateTime.fromObject(JHORA_BIRTH.utc, { zone: 'utc' });
const REF_LOCAL = REF_UTC;

beforeAll(() => {
    const ctx = runChart(JHORA_CHARTS.find((c) => c.id === '2000-01-01_1200_Greenwich')!);
    refJD = ctx.refJD;
    planets = ctx.planets;
    ascendant = ctx.ascendant;
});

const bodyLon = (name: string) => planets.find((p) => p.name === name)!.longitude;

describe('JHora Bridge: engine defaults match JHora conventions', () => {
    test('Julian Day matches', () => {
        expect(Math.abs(refJD - JHORA_BIRTH.jd)).toBeLessThan(1e-6);
    });

    test('default ayanamsa is True Chitrapaksha, and it is star-defined', () => {
        expect(AYANAMSA_MODELS[JHORA_CONVENTIONS.ayanamsaMode].kind).toBe('star');
    });

    test('default positions are geometric, not apparent', () => {
        let maxGap = 0;
        let best = 'Venus';
        for (const name of [
            'Sun',
            'Moon',
            'Mercury',
            'Venus',
            'Mars',
            'Jupiter',
            'Saturn',
        ] as const) {
            const geometric = engine.getPlanets(REF_UTC).find((p) => p.name === name)!;
            const apparent = engine
                .getPlanets(REF_UTC, undefined, { positionMode: 'apparent' })
                .find((p) => p.name === name)!;
            const gap = gapArcsec(geometric.longitude, apparent.longitude);
            if (gap > maxGap) {
                maxGap = gap;
                best = name;
            }
        }
        expect(maxGap).toBeGreaterThan(5);
        expect(
            gapArcsec(
                engine.getPlanets(REF_UTC).find((p) => p.name === best)!.longitude,
                JHORA_D1.find((b) => b.name === best)!.longitude,
            ),
        ).toBeLessThan(1);
    });

    test('default node is the true node, not the mean node', () => {
        const jhoraRahu = JHORA_D1.find((b) => b.name === 'Rahu')!.longitude;
        const mean = engine
            .getPlanets(REF_UTC, undefined, { nodeType: 'mean' })
            .find((p) => p.name === 'Rahu')!;

        expect(gapArcsec(bodyLon('Rahu'), jhoraRahu)).toBeLessThan(2);
        expect(gapArcsec(mean.longitude, jhoraRahu)).toBeGreaterThan(1800);
    });
});

describe('JHora Bridge: Ayanamsa', () => {
    test(`True Chitrapaksha = ${JHORA_AYANAMSA.printed} (±${JHORA_AYANAMSA.toleranceArcsec}″)`, () => {
        const actual = getAyanamsa(JHORA_AYANAMSA.mode, refJD);
        expect(gapArcsec(actual, JHORA_AYANAMSA.value)).toBeLessThanOrEqual(
            JHORA_AYANAMSA.toleranceArcsec,
        );
    });

    test('is derived from Spica, with no fitted constant', () => {
        const model = AYANAMSA_MODELS[27];
        expect(model).toMatchObject({ kind: 'star', star: 'Spica', atLongitude: 180 });
    });

    test('Lahiri (mode 1) mean at 1956-03-21 anchor matches IAE demeaning (jhora profile)', () => {
        expect(getAyanamsa(1, LAHIRI_ANCHOR_JD, 'geometric', 'jhora')).toBeCloseTo(23.245522527, 8);
    });

    test('Lahiri ICRC (mode 46) true ayanamsa = 23°15′00″ at 1956-03-21 (CRC declaration)', () => {
        const model = AYANAMSA_MODELS[46];
        expect(model?.kind).toBe('true_epoch');
        if (model?.kind === 'true_epoch') {
            expect(trueAyanamsaFromModel(model, 2435553.5)).toBeCloseTo(23.25, 10);
        }
    });

    test('advances at the general precession rate, ~50.3″/year', () => {
        const perYear = (getAyanamsa(27, 2451545.0 + 36525) - getAyanamsa(27, 2451545.0)) * 36;
        expect(perYear).toBeGreaterThan(50.0);
        expect(perYear).toBeLessThan(50.6);
    });

    test('accumulated precession is antisymmetric in its endpoints', () => {
        expect(
            accumulatedPrecession(2415020.5, 2460476.5) +
                accumulatedPrecession(2460476.5, 2415020.5),
        ).toBeCloseTo(0, 6);
    });
});

describe('JHora Bridge: D1 Rasi (reference chart)', () => {
    for (const ref of JHORA_D1) {
        test(`${ref.name} = ${ref.printed.trim()} (±${ref.toleranceArcsec}″)`, () => {
            expect(Math.floor(bodyLon(ref.name) / 30) + 1).toBe(ref.sign);
            expect(gapArcsec(bodyLon(ref.name), ref.longitude)).toBeLessThanOrEqual(
                ref.toleranceArcsec,
            );
        });
    }

    for (const ref of JHORA_D1.filter((b) => b.retrograde)) {
        test(`${ref.name} is retrograde, as JHora marks with (R)`, () => {
            expect(planets.find((p) => p.name === ref.name)!.speed).toBeLessThan(0);
        });
    }

    test('bodies JHora leaves unmarked are direct', () => {
        for (const ref of JHORA_D1.filter(
            (b) => !b.retrograde && b.name !== 'Rahu' && b.name !== 'Ketu',
        )) {
            expect(planets.find((p) => p.name === ref.name)!.speed).toBeGreaterThan(0);
        }
    });

    test('Ketu is exactly opposite Rahu', () => {
        expect(gapArcsec(bodyLon('Rahu') + 180, bodyLon('Ketu'))).toBeLessThan(1e-6);
    });
});

describe('JHora Bridge: Ascendant and sidereal time', () => {
    test(`Lagna = ${JHORA_ASCENDANT.printed} (±${JHORA_ASCENDANT.toleranceArcsec}″)`, () => {
        expect(Math.floor(ascendant / 30) + 1).toBe(JHORA_ASCENDANT.sign);
        expect(gapArcsec(ascendant, JHORA_ASCENDANT.longitude)).toBeLessThanOrEqual(
            JHORA_ASCENDANT.toleranceArcsec,
        );
    });

    test(`local sidereal time (±${JHORA_SIDEREAL_TIME.toleranceSeconds}s)`, () => {
        const local = (engine.getSiderealTime(refJD) + JHORA_BIRTH.lon / 15 + 24) % 24;
        expect(Math.abs(local - JHORA_SIDEREAL_TIME.hours) * 3600).toBeLessThanOrEqual(
            JHORA_SIDEREAL_TIME.toleranceSeconds,
        );
    });

    test('Whole-Sign cusps start at 0° of the ascendant sign', () => {
        const h = engine.getHouses(refJD, JHORA_BIRTH.lat, JHORA_BIRTH.lon, 'W', true);
        expect(h.cusps[0]).toBe(Math.floor(h.ascendant / 30) * 30);
        expect(h.cusps).toHaveLength(12);
    });

    test.each([
        ['Greenwich', 51.476852, -0.0005],
        ['Sydney', -33.8688, 151.2093],
        ['Reykjavík', 64.1466, -21.9426],
        ['Quito', -0.1807, -78.4678],
    ])('ascendant leads the MC by 0°–180° at %s', (_city, lat, lonDeg) => {
        for (let hour = 0; hour < 24; hour++) {
            const jd = engine.julday(
                DateTime.fromObject({ year: 2024, month: 3, day: 20, hour }, { zone: 'utc' }),
            );
            const h = engine.getHouses(jd, lat, lonDeg, 'W', false);
            const lead = (((h.ascendant - h.mc) % 360) + 360) % 360;
            expect(lead).toBeGreaterThan(0);
            expect(lead).toBeLessThan(180);
        }
    });
});

describe('JHora Bridge: D9 Navamsa (engine regression on reference chart)', () => {
    const d9 = (l: number) => {
        const v = calculateVarga(l, 9);
        return (v.sign - 1) * 30 + v.degree;
    };

    for (const ref of JHORA_D9) {
        test(`${ref.name} sign ${ref.sign}`, () => {
            const got = d9(bodyLon(ref.name));
            expect(Math.floor(got / 30) + 1).toBe(ref.sign);
            expect(gapArcsec(got, ref.longitude)).toBeLessThanOrEqual(ref.toleranceArcsec);
        });
    }

    test('Lagna navamsa', () => {
        const got = d9(ascendant);
        expect(Math.floor(got / 30) + 1).toBe(JHORA_D9_ASCENDANT.sign);
        expect(gapArcsec(got, JHORA_D9_ASCENDANT.longitude)).toBeLessThanOrEqual(
            JHORA_D9_ASCENDANT.toleranceArcsec,
        );
    });
});

describe(`JHora Bridge: D10 Dasamsa (${JHORA_D10_LABEL})`, () => {
    const d10 = (l: number, scheme: 'parashara' | 'jhora_5_8' = JHORA_D10_SCHEME) => {
        const v = calculateVarga(l, 10, { dasamsaScheme: scheme });
        return (v.sign - 1) * 30 + v.degree;
    };

    test("the library default is classical Parashara, not JHora's variant", () => {
        expect(DEFAULT_DASAMSA_SCHEME).toBe('parashara');
        expect(JHORA_D10_SCHEME).toBe('jhora_5_8');
    });

    for (const ref of JHORA_D10) {
        test(`${ref.name} sign ${ref.sign}`, () => {
            const got = d10(bodyLon(ref.name));
            expect(Math.floor(got / 30) + 1).toBe(ref.sign);
            expect(gapArcsec(got, ref.longitude)).toBeLessThanOrEqual(ref.toleranceArcsec);
        });
    }

    test('Lagna dasamsa', () => {
        const got = d10(ascendant);
        expect(Math.floor(got / 30) + 1).toBe(JHORA_D10_ASCENDANT.sign);
        expect(gapArcsec(got, JHORA_D10_ASCENDANT.longitude)).toBeLessThanOrEqual(
            JHORA_D10_ASCENDANT.toleranceArcsec,
        );
    });

    test('odd-sign bodies are identical under both schemes', () => {
        const oddSignBodies = JHORA_D10.map((b) => b.name).filter(
            (n) => !(JHORA_D10_EVEN_SIGN_BODIES as readonly string[]).includes(n),
        );

        expect(oddSignBodies.length).toBeGreaterThan(0);
        for (const name of oddSignBodies) {
            expect(d10(bodyLon(name), 'parashara')).toBeCloseTo(d10(bodyLon(name), 'jhora_5_8'), 9);
        }
    });

    test("even-sign bodies differ between the schemes, and only JHora's matches", () => {
        for (const name of JHORA_D10_EVEN_SIGN_BODIES) {
            const ref = JHORA_D10.find((b) => b.name === name)!;

            expect(gapArcsec(d10(bodyLon(name), 'jhora_5_8'), ref.longitude)).toBeLessThanOrEqual(
                ref.toleranceArcsec,
            );
            expect(gapArcsec(d10(bodyLon(name), 'parashara'), ref.longitude)).toBeGreaterThan(3600);
        }
    });

    test('the reversal is exact: Parashara degree + JHora degree = 30° in even signs', () => {
        for (const name of JHORA_D10_EVEN_SIGN_BODIES) {
            const p = calculateVarga(bodyLon(name), 10, { dasamsaScheme: 'parashara' });
            const j = calculateVarga(bodyLon(name), 10, { dasamsaScheme: 'jhora_5_8' });
            expect(p.degree + j.degree).toBeCloseTo(30, 9);
        }
    });

    test('Parashara mode follows BPHS for reference Sun in Sagittarius', () => {
        const v = calculateVarga(bodyLon('Sun'), 10, { dasamsaScheme: 'parashara' });
        expect(v.sign).toBeGreaterThanOrEqual(1);
        expect(v.sign).toBeLessThanOrEqual(12);
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

describe('JHora Bridge: Panchanga (engine regression on reference chart)', () => {
    let pa: ReturnType<typeof calculatePanchanga>;

    beforeAll(() => {
        pa = calculatePanchanga(bodyLon('Sun'), bodyLon('Moon'), REF_LOCAL);
    });

    const tol = JHORA_PANCHANGA.tolerancePercent;

    test(`Tithi = ${JHORA_PANCHANGA.tithi.name}`, () => {
        expect(pa.tithi.index).toBe(JHORA_PANCHANGA.tithi.index);
        expect(Math.abs(100 - pa.tithi.percent - JHORA_PANCHANGA.tithi.percentLeft)).toBeLessThan(
            tol,
        );
    });

    test(`Nakshatra = ${JHORA_PANCHANGA.nakshatra.name} pada ${JHORA_PANCHANGA.nakshatra.pada}`, () => {
        expect(pa.nakshatra.name).toBe(JHORA_PANCHANGA.nakshatra.name);
        expect(pa.nakshatra.index).toBe(JHORA_PANCHANGA.nakshatra.index);
        expect(pa.nakshatra.pada).toBe(JHORA_PANCHANGA.nakshatra.pada);
        expect(
            Math.abs(100 - pa.nakshatra.percent - JHORA_PANCHANGA.nakshatra.percentLeft),
        ).toBeLessThan(tol);
    });

    test(`Yoga = ${JHORA_PANCHANGA.yoga.name}`, () => {
        expect(pa.yoga.name.replace('h', '')).toBe(JHORA_PANCHANGA.yoga.name.replace('h', ''));
    });

    test(`Karana = ${JHORA_PANCHANGA.karana.name}`, () => {
        expect(pa.karana.name).toBe(JHORA_PANCHANGA.karana.name);
    });

    test(`Vara index = ${JHORA_PANCHANGA.vara.index}`, () => {
        expect(pa.vara.index).toBe(JHORA_PANCHANGA.vara.index);
    });
});
