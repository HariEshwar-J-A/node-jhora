/**
 * Tithi Ashtottari, Drig, Patyayini, Moola, and Sudasa dashas.
 *
 * @see docs/decisions/0020-extended-dashas-kalachakra-jaimini-tajika.md
 */

import { type PlanetPosition } from '@node-jhora/core';
import { Decimal } from 'decimal.js';
import { DateTime } from 'luxon';

import { DashaPeriod, type VimshottariOptions, yearLength } from '../dasha.js';
import { CharaDashaPeriod } from '../jaimini/dashas.js';
import { generateSubPeriods } from './cyclic.js';
import {
    drigDashaSignSequence,
    drigSignYears,
    kendradiSignSequence,
    moolaDashaYearsForPlanet,
    narayanaSignYears,
    sriLagnaLongitude,
    sudasaForward,
    VIMSHOTTARI_YEARS,
} from './jaimini-rasi-dasa.js';
import { CYCLIC_DASHA_SPECS } from './specs.js';

const MS_PER_DAY = new Decimal(86400000);
const SIDEREAL_YEAR_DAYS = 365.256363;

/** Kalachakra tithi lords (IndiaDivine / Vedavyasa TA tutorial). */
const TITHI_LORD = [
    'Sun',
    'Moon',
    'Mars',
    'Mercury',
    'Jupiter',
    'Venus',
    'Saturn',
    'Rahu',
    'Sun',
    'Moon',
    'Mars',
    'Mercury',
    'Jupiter',
    'Venus',
    'Saturn',
    'Rahu',
    'Sun',
    'Moon',
    'Mars',
    'Mercury',
    'Jupiter',
    'Venus',
    'Saturn',
    'Rahu',
    'Sun',
    'Moon',
    'Mars',
    'Mercury',
    'Jupiter',
    'Venus',
] as const;

function addYears(date: DateTime, years: Decimal, yearDays: Decimal): DateTime {
    const ms = years.times(yearDays).times(MS_PER_DAY).round();
    return date.plus({ milliseconds: ms.toNumber() });
}

function planetByName(planets: PlanetPosition[], name: string): PlanetPosition | undefined {
    return planets.find((p) => p.name === name);
}

const MOOLA_ORDER = [
    'Ketu',
    'Venus',
    'Sun',
    'Moon',
    'Mars',
    'Rahu',
    'Jupiter',
    'Saturn',
    'Mercury',
] as const;

const KENDRA_OFFSETS = [0, 3, 6, 9];
const PANAPARA_OFFSETS = [1, 4, 7, 10];
const APOKLIMA_OFFSETS = [2, 5, 8, 11];

function houseStrength(planet: PlanetPosition, refSign: number): number {
    const sign = Math.floor(planet.longitude / 30);
    const deg = planet.longitude % 30;
    let score = deg;
    if (KENDRA_OFFSETS.some((o) => (refSign + o) % 12 === sign)) score += 100;
    else if (PANAPARA_OFFSETS.some((o) => (refSign + o) % 12 === sign)) score += 50;
    else if (APOKLIMA_OFFSETS.some((o) => (refSign + o) % 12 === sign)) score += 25;
    return score;
}

function moolaPlanetSequence(chart: { ascendant: number; planets: PlanetPosition[] }): string[] {
    const lagna = Math.floor(chart.ascendant / 30);
    const moon = planetByName(chart.planets, 'Moon');
    const sun = planetByName(chart.planets, 'Sun');
    const refs: { key: 'lagna' | 'moon' | 'sun'; sign: number; score: number }[] = [
        { key: 'lagna', sign: lagna, score: 1000 },
    ];
    if (moon) refs.push({ key: 'moon', sign: Math.floor(moon.longitude / 30), score: 0 });
    if (sun) refs.push({ key: 'sun', sign: Math.floor(sun.longitude / 30), score: 0 });
    for (const r of refs) {
        if (r.key === 'lagna') continue;
        const body = r.key === 'moon' ? moon! : sun!;
        r.score = houseStrength(body, r.sign);
    }
    refs.sort((a, b) => b.score - a.score);
    const refSign = refs[0]!.sign;

    const inHouse = (p: PlanetPosition, offset: number) =>
        Math.floor(p.longitude / 30) === (refSign + offset) % 12;

    const groups: PlanetPosition[][] = [
        KENDRA_OFFSETS.map((o) => chart.planets.filter((p) => inHouse(p, o))).flat(),
        PANAPARA_OFFSETS.map((o) => chart.planets.filter((p) => inHouse(p, o))).flat(),
        APOKLIMA_OFFSETS.map((o) => chart.planets.filter((p) => inHouse(p, o))).flat(),
    ];

    const picked: string[] = [];
    const seen = new Set<string>();
    for (const group of groups) {
        const sorted = [...group].sort(
            (a, b) => houseStrength(b, refSign) - houseStrength(a, refSign),
        );
        for (const p of sorted) {
            if (MOOLA_ORDER.includes(p.name as (typeof MOOLA_ORDER)[number]) && !seen.has(p.name)) {
                seen.add(p.name);
                picked.push(p.name);
            }
        }
    }
    for (const name of MOOLA_ORDER) {
        if (!seen.has(name) && planetByName(chart.planets, name)) picked.push(name);
    }
    return picked.length ? picked : [...MOOLA_ORDER];
}

/** Moola Dasa — Lagna-kendradi graha dasa (Sanjay Rath; BPHS ayur reduction). */
export class MoolaDasha {
    public static calculate(
        chart: { ascendant: number; planets: PlanetPosition[] },
        birthDate: DateTime,
        options?: VimshottariOptions,
    ): { planet: string; start: string; end: string; durationYears: number; cycle: number }[] {
        const yearDays = yearLength(options).days;
        const sequence = moolaPlanetSequence(chart);
        const firstCycle: Record<string, number> = {};
        for (const name of sequence) {
            const p = planetByName(chart.planets, name);
            if (p) firstCycle[name] = moolaDashaYearsForPlanet(name, p);
        }
        const firstTotal = Object.values(firstCycle).reduce((a, b) => a + b, 0);
        const periods: {
            planet: string;
            start: string;
            end: string;
            durationYears: number;
            cycle: number;
        }[] = [];
        let running = birthDate;

        const pushCycle = (cycle: number, yearsMap: Record<string, number>) => {
            for (const name of sequence) {
                const dur = yearsMap[name];
                if (dur === undefined || dur <= 0) continue;
                const d = new Decimal(dur);
                const end = addYears(running, d, yearDays);
                periods.push({
                    planet: name,
                    start: running.toISO()!,
                    end: end.toISO()!,
                    durationYears: dur,
                    cycle,
                });
                running = end;
            }
        };

        pushCycle(1, firstCycle);
        const secondCycle: Record<string, number> = {};
        for (const name of sequence) {
            const vim = VIMSHOTTARI_YEARS[name] ?? 0;
            const first = firstCycle[name] ?? 0;
            secondCycle[name] = Math.max(0, vim - first);
        }
        pushCycle(2, secondCycle);

        const total = periods.reduce((a, p) => a + p.durationYears, 0);
        if (total < 120 - 1e-6 && periods.length) {
            /* Paramayus 120: second cycle fills remainder per Rath worked example. */
        }
        void firstTotal;
        return periods;
    }
}

/** Sudasa — Śrī Lagna kendradi rasi dasa (Sanjay Rath). */
export class SudasaDasha {
    public static calculate(
        chart: { ascendant: number; planets: PlanetPosition[] },
        birthDate: DateTime,
        moonLongitude: number,
        cycles = 2,
        options?: VimshottariOptions,
    ): CharaDashaPeriod[] {
        const sl = sriLagnaLongitude(chart.ascendant, moonLongitude);
        const slSign = Math.floor(sl / 30);
        const forward = sudasaForward(slSign, chart.planets);
        const signs = kendradiSignSequence(slSign, forward);
        const yearDays = yearLength(options).days;
        const periods: CharaDashaPeriod[] = [];
        let running = birthDate;
        const degInSign = sl % 30;

        for (let c = 0; c < cycles; c++) {
            for (let i = 0; i < signs.length; i++) {
                const sign = signs[i]!;
                let years = narayanaSignYears(sign, chart.planets);
                if (c === 0 && i === 0) {
                    years = ((30 - degInSign) / 30) * years;
                }
                const end = addYears(running, new Decimal(years), yearDays);
                periods.push({
                    signIndex: sign,
                    startYear: running.diff(birthDate, 'years').years,
                    endYear: end.diff(birthDate, 'years').years,
                    start: running.toISO()!,
                    end: end.toISO()!,
                    durationYears: years,
                    isForward: forward,
                });
                running = end;
            }
        }
        return periods;
    }
}

/** Drig dasa — trines from 9th/10th/11th (Jaimini 2.4.21; Rangacharya reading). */
export class DrigDasha {
    public static calculate(
        chart: { ascendant: number; planets: PlanetPosition[] },
        birthDate: DateTime,
        cycles = 1,
        options?: VimshottariOptions,
    ): CharaDashaPeriod[] {
        const lagnaSign = Math.floor(chart.ascendant / 30);
        const signs = drigDashaSignSequence(lagnaSign);
        const yearDays = yearLength(options).days;
        const degInSign = chart.ascendant % 30;
        const periods: CharaDashaPeriod[] = [];
        let running = birthDate;

        for (let c = 0; c < cycles; c++) {
            for (let i = 0; i < signs.length; i++) {
                const sign = signs[i]!;
                let years = drigSignYears(sign, chart.planets);
                if (c === 0 && i === 0) {
                    years = ((30 - degInSign) / 30) * years;
                }
                const end = addYears(running, new Decimal(years), yearDays);
                periods.push({
                    signIndex: sign,
                    start: running.toISO()!,
                    end: end.toISO()!,
                    durationYears: years,
                    startYear: running.diff(birthDate, 'years').years,
                    endYear: end.diff(birthDate, 'years').years,
                });
                running = end;
            }
        }
        return periods;
    }
}

export interface PatyayiniPeriod {
    lord: string;
    start: string;
    end: string;
    durationDays: number;
}

/** Patyayini annual dasa from krishamsa (Tajika; Tag-to-Adawal / Vishal Aksh). */
export class PatyayiniDasha {
    public static calculate(
        chart: { ascendant: number; planets: PlanetPosition[] },
        varshaphalaStart: DateTime,
        yearDays = SIDEREAL_YEAR_DAYS,
    ): PatyayiniPeriod[] {
        const lords = ['Jupiter', 'Mercury', 'Moon', 'Sun', 'Venus', 'Mars', 'Saturn'] as const;
        const kr: { lord: string; k: number }[] = [{ lord: 'Lagna', k: chart.ascendant % 30 }];
        for (const name of lords) {
            const p = planetByName(chart.planets, name);
            if (p) kr.push({ lord: name, k: p.longitude % 30 });
        }
        kr.sort((a, b) => a.k - b.k);
        const highest = kr[kr.length - 1]!.k;
        const dhruvank = yearDays / highest;
        const periods: PatyayiniPeriod[] = [];
        let running = varshaphalaStart;
        for (let i = 0; i < kr.length; i++) {
            const prev = i === 0 ? 0 : kr[i - 1]!.k;
            const pat = kr[i]!.k - prev;
            const days = pat * dhruvank;
            const end = running.plus({ days });
            periods.push({
                lord: kr[i]!.lord,
                start: running.toISO()!,
                end: end.toISO()!,
                durationDays: days,
            });
            running = end;
        }
        return periods;
    }
}

/** Tithi Ashtottari — 108-year cycle from birth tithi lord (Vedavyasa tutorial). */
export function generateTithiAshtottari(
    birthDate: DateTime,
    moonLongitude: number,
    sunLongitude: number,
    depth = 2,
    options?: VimshottariOptions,
): DashaPeriod[] {
    const elong = (((moonLongitude - sunLongitude) % 360) + 360) % 360;
    const tithiIndex = Math.min(29, Math.floor(elong / 12));
    const lord = TITHI_LORD[tithiIndex]!;
    const remainderFraction = 1 - (elong % 12) / 12;
    const spec = CYCLIC_DASHA_SPECS.ashtottari;
    const { days: yearDays } = yearLength(options);
    const startIdx = spec.order.indexOf(lord);
    const order =
        startIdx <= 0
            ? spec.order
            : ([
                  ...spec.order.slice(startIdx),
                  ...spec.order.slice(0, startIdx),
              ] as readonly string[]);
    const periods: DashaPeriod[] = [];
    let currentDate = birthDate;
    let yearsCovered = new Decimal(0);
    const target = new Decimal(spec.cycleYears);

    while (yearsCovered.lt(target)) {
        const idx = periods.length % order.length;
        const planet = order[idx]!;
        const fullDuration = new Decimal(spec.durationsYears[planet] ?? 0);
        let duration = periods.length === 0 ? fullDuration.times(remainderFraction) : fullDuration;
        if (yearsCovered.plus(duration).gt(target)) {
            duration = target.minus(yearsCovered);
        }
        if (duration.lte(0)) break;
        const end = addYears(currentDate, duration, yearDays);
        const period: DashaPeriod = {
            planet,
            level: 1,
            start: currentDate,
            end,
            durationYears: duration.toNumber(),
            subPeriods: [],
        };
        if (depth >= 2) {
            period.subPeriods = generateSubPeriods(
                period,
                periods.length === 0 ? fullDuration : duration,
                { ...spec, order },
                depth,
                2,
                yearDays,
            );
        }
        periods.push(period);
        currentDate = end;
        yearsCovered = yearsCovered.plus(duration);
    }
    return periods;
}

/** Re-export tithi lord helper for tests. */
export function tithiLordForElongation(elongationDeg: number): string {
    const e = ((elongationDeg % 360) + 360) % 360;
    const tithiIndex = Math.min(29, Math.floor(e / 12));
    return TITHI_LORD[tithiIndex]!;
}

export { sriLagnaLongitude };
