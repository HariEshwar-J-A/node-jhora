/**
 * known-gap — residuals that are not under 1″, recorded as ceilings.
 *
 * Mean node outside years 0..2150. Meeus eq. (47.7) tropical longitude;
 * That ayanamsa matches the oracles, so the deep-era residual is the tropical
 * polynomial, not a second precession. Each era's bound is the measured |Δ|,
 * rounded up by at most 0.01″. A larger residual fails.
 *
 * These cases always run. They are not skipped when DE431 chunks are absent:
 * the mean node and geometric True Chitra do not read the planetary kernel.
 */

import { DateTime } from 'luxon';
import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { julianCenturies } from '../../src/engine/coordinates.js';
import { deltaT } from '../../src/engine/deltat.js';
import { meanLunarNode } from '../../src/engine/ayanamsa.js';
import {
    MEAN_MODES,
    NODE_CASES,
    gapArcsec,
    meanGapEra,
    meanSidereal,
    oracleOf,
    type MeanGapEra,
    type NodeMode,
} from './lunar-node-oracle-support.js';

/** Measured mean-node |Δ| per era, arcseconds, rounded up ≤ 0.01″. */
const MEAN_GAP_ARCSEC: Record<MeanGapEra, Record<NodeMode, number>> = {
    'before-3000': { J: 953.14, Jo: 953.14, M: 949.73, Mo: 949.73 },
    'neg3000-to-0': { J: 14.35, Jo: 14.35, M: 14.26, Mo: 14.26 },
    '2151-to-3000': { J: 2.29, Jo: 2.29, M: 2.08, Mo: 2.08 },
    'after-3000': { J: 81.8, Jo: 81.8, M: 83.74, Mo: 83.74 },
};

const outside = NODE_CASES.filter((c) => meanGapEra(c.y) !== null);

let engine: EphemerisEngine;

beforeAll(async () => {
    engine = new EphemerisEngine();
    await engine.initialize();
}, 120_000);

describe('known-gap mean node outside years 0..2150', () => {
    test.each(Object.keys(MEAN_GAP_ARCSEC) as MeanGapEra[])(
        'era %s stays within its measured ceiling for both oracles',
        (era) => {
            const rows = outside.filter((c) => meanGapEra(c.y) === era);
            expect(rows.length).toBeGreaterThan(0);
            const failures: string[] = [];
            for (const c of rows) {
                for (const mode of MEAN_MODES) {
                    const err = gapArcsec(
                        meanSidereal(engine, c, mode),
                        oracleOf(c, mode).mean.lon,
                    );
                    const bound = MEAN_GAP_ARCSEC[era][mode];
                    if (!(err <= bound)) {
                        failures.push(`#${c.id} y=${c.y} ${mode} ${err.toFixed(3)}″ > ${bound}″`);
                    }
                }
            }
            expect(failures).toEqual([]);
        },
    );
});

describe('known-gap dates do not throw', () => {
    test('mean node and geometric True Chitra accept −10000..+10000', () => {
        const samples = [-10000, -3000, -1, 0, 1, 1582, 1850, 2150, 3000, 10000];
        for (const year of samples) {
            const dt = DateTime.fromObject(
                { year, month: 6, day: 15, hour: 12, minute: 0, second: 0 },
                { zone: 'utc' },
            );
            expect(dt.isValid).toBe(true);
            const jd = engine.julday(dt);
            expect(Number.isFinite(jd)).toBe(true);
            const trop = meanLunarNode(julianCenturies(jd + deltaT(jd) / 86400));
            expect(Number.isFinite(trop)).toBe(true);
            const ayan = engine.getAyanamsa(jd, 27, 0, 'geometric');
            expect(Number.isFinite(ayan)).toBe(true);
        }
    });
});
