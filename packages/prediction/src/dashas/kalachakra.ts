// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Kalachakra Dasha — nine-rashi mahadashas from the Moon's nakshatra pada.
 *
 * Balance uses the whole-cycle paramayus depletion on the 3°20′ pada
 * (BPHS v. 93: past arc × paramayus / 200′; equivalent to fraction × paramayus).
 *
 * @provenance BPHS ch. 46 vv. 85–95; P.V.R. Narasimha Rao, Kalachakra article
 *   (whole-cycle paramayus); Sanjay Rath course notes on Deha/Jiva.
 * @see docs/decisions/0020-extended-dashas-kalachakra-jaimini-tajika.md
 */

import { Decimal } from '@node-jhora/core';
import { DateTime } from 'luxon';

import { type VimshottariOptions, yearLength } from '../dasha.js';
import {
    KALACHAKRA_SIGN_YEARS,
    type KalachakraChakra,
    kalachakraPadaRow,
    moonPadaFraction,
} from './kalachakra-tables.js';

const MS_PER_DAY = new Decimal(86400000);

export interface KalachakraDashaPeriod {
    signIndex: number;
    signYears: number;
    start: string;
    end: string;
    durationYears: number;
    deha: boolean;
    jiva: boolean;
    subPeriods?: KalachakraDashaPeriod[];
}

export interface KalachakraDashaResult {
    nakshatraIndex: number;
    pada: number;
    chakra: KalachakraChakra;
    paramayusYears: number;
    dehaSign: number;
    jivaSign: number;
    elapsedYearsAtBirth: number;
    balanceYearsAtBirth: number;
    periods: KalachakraDashaPeriod[];
}

function addYears(date: DateTime, years: Decimal, yearDays: Decimal): DateTime {
    const ms = years.times(yearDays).times(MS_PER_DAY).round();
    return date.plus({ milliseconds: ms.toNumber() });
}

function locateActiveSign(
    signs: readonly number[],
    elapsedYears: number,
): { index: number; remainingInSign: number } {
    let e = elapsedYears;
    for (let i = 0; i < signs.length; i++) {
        const yrs = KALACHAKRA_SIGN_YEARS[signs[i]!]!;
        if (e <= yrs + 1e-9) {
            return { index: i, remainingInSign: yrs - e };
        }
        e -= yrs;
    }
    return { index: signs.length - 1, remainingInSign: 0 };
}

export class KalachakraDasha {
    /**
     * Compute Kalachakra mahadashas for one paramayus run (does not cross into the
     * next nakshatra pada when the run completes — BPHS / JHora convention).
     */
    public static calculate(
        birthDate: DateTime,
        moonLongitude: number,
        depth = 1,
        options?: VimshottariOptions,
    ): KalachakraDashaResult {
        const row = kalachakraPadaRow(moonLongitude);
        const fraction = moonPadaFraction(moonLongitude);
        const elapsed = fraction * row.paramayusYears;
        const balance = row.paramayusYears - elapsed;
        const { index: startIdx, remainingInSign } = locateActiveSign(row.signs, elapsed);
        const yearDays = yearLength(options).days;

        const periods: KalachakraDashaPeriod[] = [];
        let running = birthDate;
        let yearsLeft = balance;

        for (let i = startIdx; i < row.signs.length && yearsLeft > 1e-6; i++) {
            const sign = row.signs[i]!;
            const full = KALACHAKRA_SIGN_YEARS[sign]!;
            const dur =
                i === startIdx ? Math.min(remainingInSign, yearsLeft) : Math.min(full, yearsLeft);
            if (dur <= 0) continue;
            const durDec = new Decimal(dur);
            const end = addYears(running, durDec, yearDays);
            periods.push({
                signIndex: sign,
                signYears: full,
                start: running.toISO()!,
                end: end.toISO()!,
                durationYears: dur,
                deha: sign === row.dehaSign,
                jiva: sign === row.jivaSign,
            });
            running = end;
            yearsLeft -= dur;
        }

        if (depth >= 2) {
            for (const p of periods) {
                p.subPeriods = KalachakraDasha.antardashas(
                    p,
                    row.signs,
                    row.paramayusYears,
                    yearDays,
                );
            }
        }

        const lon = ((moonLongitude % 360) + 360) % 360;
        const padaIndex = Math.floor(lon / (360 / 108));

        return {
            nakshatraIndex: Math.floor(padaIndex / 4),
            pada: (padaIndex % 4) + 1,
            chakra: row.chakra,
            paramayusYears: row.paramayusYears,
            dehaSign: row.dehaSign,
            jivaSign: row.jivaSign,
            elapsedYearsAtBirth: elapsed,
            balanceYearsAtBirth: balance,
            periods,
        };
    }

    /** BPHS v. 13 / Phaladeepika v. 13: sub-period ∝ graha year × maha / paramayus. */
    private static antardashas(
        maha: KalachakraDashaPeriod,
        signs: readonly number[],
        paramayus: number,
        yearDays: Decimal,
    ): KalachakraDashaPeriod[] {
        const subs: KalachakraDashaPeriod[] = [];
        const mahaIdx = signs.indexOf(maha.signIndex);
        const order =
            mahaIdx >= 0
                ? [...signs.slice(mahaIdx + 1), ...signs.slice(0, mahaIdx + 1)]
                : [...signs];
        let running: DateTime = DateTime.fromISO(maha.start)!;
        const mahaDur = new Decimal(maha.durationYears);
        for (const sign of order) {
            const std = KALACHAKRA_SIGN_YEARS[sign]!;
            const subDur = mahaDur.times(std).div(paramayus);
            const end = addYears(running, subDur, yearDays);
            subs.push({
                signIndex: sign,
                signYears: std,
                start: running.toISO()!,
                end: end.toISO()!,
                durationYears: subDur.toNumber(),
                deha: maha.deha && sign === maha.signIndex,
                jiva: maha.jiva && sign === maha.signIndex,
            });
            running = end;
        }
        return subs;
    }
}
