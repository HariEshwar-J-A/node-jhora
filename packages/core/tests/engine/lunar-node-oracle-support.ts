/**
 * Shared loader for the full-range lunar-node oracles.
 * The fixture is test data only (JHora SE 2.02 export and pyswisseph 2.10).
 */

import { readFileSync } from 'node:fs';
import { DateTime } from 'luxon';
import type { EphemerisEngine, PrecisionOptions } from '../../src/engine/ephemeris.js';
import {
    withDeltaTContext,
    LAST_OBSERVED_YEAR_MODERN,
    decimalYear,
} from '../../src/engine/deltat.js';
import { julianCenturies } from '../../src/engine/coordinates.js';
import { deltaT } from '../../src/engine/deltat.js';
import { meanLunarNode } from '../../src/engine/ayanamsa.js';

export interface NodeSample {
    lon: number;
    speed: number;
}

export interface ProfileOracle {
    deltaT: number;
    ayan: number;
    mean: NodeSample;
    true: NodeSample;
}

export interface NodeCase {
    id: number;
    tag: string;
    y: number;
    m: number;
    d: number;
    H: number;
    M: number;
    S: number;
    jd: number;
    lat: number;
    lon: number;
    jhora: ProfileOracle;
    modern: ProfileOracle;
}

/** DE440s coverage, JD(UT), with a day of margin for ΔT. Same window as the SE 2.10 golden. */
export const DE440S_FIRST = 2396758.5 + 1;
export const DE440S_LAST = 2506331.5 - 1;

export type NodeMode = 'J' | 'Jo' | 'M' | 'Mo';

export type MeanGapEra = 'before-3000' | 'neg3000-to-0' | '2151-to-3000' | 'after-3000';

const fixture = JSON.parse(
    readFileSync(new URL('../fixtures/lunar-node-oracle.json', import.meta.url), 'utf8'),
) as { cases: NodeCase[] };

export const NODE_CASES: readonly NodeCase[] = fixture.cases;

export function inWindow(c: NodeCase): boolean {
    return c.y >= 0 && c.y <= 2150;
}

export function inDe440s(jd: number): boolean {
    return jd > DE440S_FIRST && jd < DE440S_LAST;
}

export function meanGapEra(y: number): MeanGapEra | null {
    if (y < -3000) return 'before-3000';
    if (y < 0) return 'neg3000-to-0';
    if (y <= 2150) return null;
    if (y <= 3000) return '2151-to-3000';
    return 'after-3000';
}

/**
 * Fixture `y-m-d` labels are proleptic Gregorian, including before 1582-10-15
 * and the ten reform-gap dates. The chart default (`'auto'`) reads those as
 * Julian and rejects 1582-10-05…14, so the oracle comparison must name the
 * calendar the labels were written in.
 */
export const FIXTURE_CALENDAR = 'gregorian' as const;

export function civilUtc(c: NodeCase): DateTime {
    return DateTime.fromObject(
        { year: c.y, month: c.m, day: c.d, hour: c.H, minute: c.M, second: c.S },
        { zone: 'utc' },
    );
}

/** Julian day of a fixture label, in the calendar the oracle used. */
export function fixtureJd(engine: EphemerisEngine, c: NodeCase): number {
    return engine.julday(civilUtc(c), { calendar: FIXTURE_CALENDAR });
}

/** Absolute separation in arcseconds. Speed uses the same wrap; daily rates are ≪ 180°. */
export function gapArcsec(a: number, b: number): number {
    let d = (a - b) % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return Math.abs(d) * 3600;
}

export function modeOptions(c: NodeCase, mode: NodeMode): PrecisionOptions {
    if (mode === 'J') return { precisionProfile: 'jhora' };
    if (mode === 'Jo') return { precisionProfile: 'jhora', deltaTOverrideSeconds: c.jhora.deltaT };
    if (mode === 'M') return { precisionProfile: 'modern' };
    return { precisionProfile: 'modern', deltaTOverrideSeconds: c.modern.deltaT };
}

export function oracleOf(c: NodeCase, mode: NodeMode): ProfileOracle {
    return mode === 'J' || mode === 'Jo' ? c.jhora : c.modern;
}

/**
 * Modes that gate the true node. Modern dates after the observed ΔT record
 * compare at the oracle's ΔT (Mo): native modern ΔT there is a forecast, and
 * the SE 2.10 golden uses the same split.
 */
export function trueNodeModes(decimalY: number): NodeMode[] {
    const modes: NodeMode[] = ['J', 'Jo', 'Mo'];
    if (decimalY <= LAST_OBSERVED_YEAR_MODERN) modes.push('M');
    return modes;
}

/** Every mean-node comparison, including native modern ΔT. */
export const MEAN_MODES: readonly NodeMode[] = ['J', 'Jo', 'M', 'Mo'];

function mod360(x: number): number {
    return ((x % 360) + 360) % 360;
}

/** Sidereal mean node: Meeus tropical minus geometric True Chitra (engine default). */
export function meanSidereal(engine: EphemerisEngine, c: NodeCase, mode: NodeMode): number {
    const options = modeOptions(c, mode);
    return withDeltaTContext(
        { profile: options.precisionProfile, overrideSeconds: options.deltaTOverrideSeconds },
        () => {
            const jd = fixtureJd(engine, c);
            const trop = meanLunarNode(julianCenturies(jd + deltaT(jd) / 86400));
            const ayan = engine.getAyanamsa(jd, 27, 0, 'geometric');
            return mod360(trop - ayan);
        },
    );
}

export function trueNode(
    engine: EphemerisEngine,
    c: NodeCase,
    mode: NodeMode,
): { lon: number; speed: number } {
    const ps = engine.getPlanets(
        civilUtc(c),
        { latitude: c.lat, longitude: c.lon },
        {
            ayanamsaOrder: 27,
            nodeType: 'true',
            calendar: FIXTURE_CALENDAR,
            ...modeOptions(c, mode),
        },
    );
    const rahu = ps.find((p) => p.name === 'Rahu');
    if (!rahu) throw new Error(`Rahu missing for case ${c.id}`);
    return { lon: rahu.longitude, speed: rahu.speed };
}

export function decimalYearOf(engine: EphemerisEngine, c: NodeCase): number {
    return decimalYear(fixtureJd(engine, c));
}
