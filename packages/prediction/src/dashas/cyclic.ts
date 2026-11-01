import { Decimal } from '@node-jhora/core';
import { DateTime } from 'luxon';

import { DashaPeriod, VimshottariOptions, yearLength } from '../dasha.js';
import { CYCLIC_DASHA_SPECS, type CyclicDashaId, type CyclicDashaSpec } from './specs.js';

const NAK_SPAN = new Decimal(360).div(27);
const MS_PER_DAY = new Decimal(86400000);

function addYears(date: DateTime, years: Decimal, yearDays: Decimal): DateTime {
    const ms = years.times(yearDays).times(MS_PER_DAY).round();
    return date.plus({ milliseconds: ms.toNumber() });
}

export interface CyclicDashaBalance {
    lord: string;
    yearsRemaining: number;
    totalDuration: number;
    fractionTraversed: number;
    nakshatraIndex: number;
}

export function calculateCyclicDashaBalance(
    spec: CyclicDashaSpec,
    moonLongitude: number,
): CyclicDashaBalance {
    const lon = new Decimal(moonLongitude).mod(360);
    const absLon = lon.isNegative() ? lon.plus(360) : lon;
    const nakIdx = absLon.div(NAK_SPAN).floor().toNumber();
    const lonInNak = absLon.mod(NAK_SPAN);
    const fractionTraversed = lonInNak.div(NAK_SPAN);
    const lord = spec.startingLord(moonLongitude);
    const totalDuration = spec.durationsYears[lord] ?? 0;
    const yearsRemaining = new Decimal(1).minus(fractionTraversed).times(totalDuration).toNumber();
    return {
        lord,
        yearsRemaining,
        totalDuration,
        fractionTraversed: fractionTraversed.toNumber(),
        nakshatraIndex: nakIdx,
    };
}

export function generateSubPeriods(
    parent: DashaPeriod,
    parentStandardYears: Decimal,
    spec: CyclicDashaSpec,
    maxDepth: number,
    currentDepth: number,
    yearDays: Decimal,
): DashaPeriod[] {
    const traversedYears = parentStandardYears.minus(parent.durationYears);
    const isPartial = traversedYears.abs().gt(new Decimal('0.0001'));
    const conceptualStart = isPartial
        ? addYears(parent.start, traversedYears.negated(), yearDays)
        : parent.start;

    const parentLordIdx = spec.order.indexOf(parent.planet);
    const subPeriods: DashaPeriod[] = [];
    let currentP = conceptualStart;
    const n = spec.order.length;

    for (let i = 0; i < n; i++) {
        const subLord = spec.order[(parentLordIdx + i) % n]!;
        const childStdYears = new Decimal(spec.durationsYears[subLord] ?? 0);
        const subDuration = parentStandardYears.times(childStdYears).div(spec.cycleYears);
        const subEnd = addYears(currentP, subDuration, yearDays);

        if (subEnd <= parent.start) {
            currentP = subEnd;
            continue;
        }

        const actualStart = currentP < parent.start ? parent.start : currentP;
        const actualDuration = new Decimal(subEnd.toMillis() - actualStart.toMillis()).div(
            yearDays.times(MS_PER_DAY),
        );

        const subPeriod: DashaPeriod = {
            planet: subLord,
            level: currentDepth,
            start: actualStart,
            end: subEnd,
            durationYears: actualDuration.toNumber(),
            subPeriods: [],
        };

        if (currentDepth < maxDepth) {
            subPeriod.subPeriods = generateSubPeriods(
                subPeriod,
                subDuration,
                spec,
                maxDepth,
                currentDepth + 1,
                yearDays,
            );
        }

        subPeriods.push(subPeriod);
        currentP = subEnd;
    }

    return subPeriods;
}

export function generateCyclicDasha(
    id: CyclicDashaId,
    birthDate: DateTime,
    moonLongitude: number,
    depth: number = 2,
    options?: VimshottariOptions,
): DashaPeriod[] {
    const spec = CYCLIC_DASHA_SPECS[id];
    const { days: yearDays, settingsHash } = yearLength(options);
    const balance = calculateCyclicDashaBalance(spec, moonLongitude);
    const periods: DashaPeriod[] = [];
    let currentDate = birthDate;
    let currentIndex = spec.order.indexOf(balance.lord);
    if (currentIndex < 0) currentIndex = 0;
    let yearsCovered = new Decimal(0);
    const target = new Decimal(spec.cycleYears);

    while (yearsCovered.lt(target)) {
        const planet = spec.order[currentIndex % spec.order.length]!;
        const fullDuration = new Decimal(spec.durationsYears[planet] ?? 0);
        const isFirst = periods.length === 0;
        const duration = isFirst ? new Decimal(balance.yearsRemaining) : fullDuration;
        const start = currentDate;
        const end = addYears(start, duration, yearDays);
        const period: DashaPeriod = {
            planet,
            level: 1,
            start,
            end,
            durationYears: duration.toNumber(),
            subPeriods: [],
        };
        if (depth >= 2) {
            period.subPeriods = generateSubPeriods(period, fullDuration, spec, depth, 2, yearDays);
        }
        periods.push(period);
        currentDate = end;
        yearsCovered = yearsCovered.plus(duration);
        currentIndex++;
    }

    if (settingsHash) {
        for (const p of periods) stamp(p, settingsHash);
    }
    return periods;
}

function stamp(period: DashaPeriod, hash: string): void {
    period.settingsHash = hash;
    for (const sub of period.subPeriods ?? []) stamp(sub, hash);
}

export function generateAshtottari(
    birthDate: DateTime,
    moonLongitude: number,
    depth?: number,
    options?: VimshottariOptions,
): DashaPeriod[] {
    return generateCyclicDasha('ashtottari', birthDate, moonLongitude, depth, options);
}

export function generateShodashottari(
    birthDate: DateTime,
    moonLongitude: number,
    depth?: number,
    options?: VimshottariOptions,
): DashaPeriod[] {
    return generateCyclicDasha('shodashottari', birthDate, moonLongitude, depth, options);
}

export function generateDwadashottari(
    birthDate: DateTime,
    moonLongitude: number,
    depth?: number,
    options?: VimshottariOptions,
): DashaPeriod[] {
    return generateCyclicDasha('dwadashottari', birthDate, moonLongitude, depth, options);
}

export function generatePanchottari(
    birthDate: DateTime,
    moonLongitude: number,
    depth?: number,
    options?: VimshottariOptions,
): DashaPeriod[] {
    return generateCyclicDasha('panchottari', birthDate, moonLongitude, depth, options);
}

export function generateShatabdika(
    birthDate: DateTime,
    moonLongitude: number,
    depth?: number,
    options?: VimshottariOptions,
): DashaPeriod[] {
    return generateCyclicDasha('shatabdika', birthDate, moonLongitude, depth, options);
}

export function generateChaturashitiSama(
    birthDate: DateTime,
    moonLongitude: number,
    depth?: number,
    options?: VimshottariOptions,
): DashaPeriod[] {
    return generateCyclicDasha('chaturashiti_sama', birthDate, moonLongitude, depth, options);
}

export function generateDwisaptatiSama(
    birthDate: DateTime,
    moonLongitude: number,
    depth?: number,
    options?: VimshottariOptions,
): DashaPeriod[] {
    return generateCyclicDasha('dwisaptati_sama', birthDate, moonLongitude, depth, options);
}

export function generateShashtiHayani(
    birthDate: DateTime,
    moonLongitude: number,
    depth?: number,
    options?: VimshottariOptions,
): DashaPeriod[] {
    return generateCyclicDasha('shashti_hayani', birthDate, moonLongitude, depth, options);
}
