import { ChartData } from '@node-jhora/analytics';
import { Body } from '@node-jhora/core';
import { DateTime } from 'luxon';

import { CharaDashaPeriod, JaiminiDashas } from '../jaimini/dashas.js';

/**
 * Sudasa (Śrī Lagna kendradi) — Jaimini wealth dasha.
 * Uses {@link calculateShreeLagna} when available on the chart ascendant bundle.
 */
export class SudasaDasha {
    public static calculate(
        chart: ChartData,
        sriLagnaLongitude: number,
        birthDate: DateTime,
        cycles: number = 2,
    ): CharaDashaPeriod[] {
        const sriSign = Math.floor(sriLagnaLongitude / 30);
        const isForward = sriSign % 2 === 0;
        const periods: CharaDashaPeriod[] = [];
        let runningDate = birthDate;
        const degInSign = sriLagnaLongitude % 30;
        let currentSign = sriSign;

        for (let i = 0; i < 12 * cycles; i++) {
            let duration = JaiminiDashas.calculateSignDuration(currentSign, chart.planets);
            if (i === 0) {
                duration = ((30 - degInSign) / 30) * duration;
            }
            periods.push({
                signIndex: currentSign,
                startYear: runningDate.diff(birthDate, 'years').years,
                endYear: runningDate.plus({ years: duration }).diff(birthDate, 'years').years,
                start: runningDate.toISO()!,
                end: runningDate.plus({ years: duration }).toISO()!,
                durationYears: duration,
                isForward,
            });
            runningDate = runningDate.plus({ years: duration });
            if (isForward) currentSign = (currentSign + 1) % 12;
            else currentSign = (currentSign + 11) % 12;
        }
        return periods;
    }
}

/** Simplified Moola Dasha: vimshottari-ordered grahas in kendras with reduced years. */
export class MoolaDasha {
    private static readonly ORDER = [
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

    private static readonly BASE: Record<string, number> = {
        Ketu: 7,
        Venus: 20,
        Sun: 6,
        Moon: 10,
        Mars: 7,
        Rahu: 18,
        Jupiter: 16,
        Saturn: 19,
        Mercury: 17,
    };

    public static calculate(
        chart: ChartData,
        birthDate: DateTime,
        years: number = 120,
    ): {
        planet: string;
        start: string;
        end: string;
        durationYears: number;
    }[] {
        const lagnaSign = Math.floor(chart.ascendant / 30);
        const kendras = [
            lagnaSign,
            (lagnaSign + 3) % 12,
            (lagnaSign + 6) % 12,
            (lagnaSign + 9) % 12,
        ];
        const occupied = this.ORDER.filter((name) => {
            const id = this.planetId(name);
            const p = chart.planets.find((pl) => pl.id === id);
            if (!p) return false;
            const sign = Math.floor(p.longitude / 30);
            return kendras.includes(sign);
        });
        const sequence = occupied.length ? occupied : [...this.ORDER];
        const periods: { planet: string; start: string; end: string; durationYears: number }[] = [];
        let running = birthDate;
        let covered = 0;
        let idx = 0;
        while (covered < years && periods.length < 24) {
            const planet = sequence[idx % sequence.length]!;
            const dur = Math.max(1, this.BASE[planet]! - 3);
            const end = running.plus({ years: dur });
            periods.push({
                planet,
                start: running.toISO()!,
                end: end.toISO()!,
                durationYears: dur,
            });
            running = end;
            covered += dur;
            idx++;
        }
        return periods;
    }

    private static planetId(name: string): number {
        const map: Record<string, number> = {
            Sun: Body.Sun,
            Moon: Body.Moon,
            Mars: Body.Mars,
            Mercury: Body.Mercury,
            Jupiter: Body.Jupiter,
            Venus: Body.Venus,
            Saturn: Body.Saturn,
            Rahu: Body.Rahu,
            Ketu: Body.Ketu,
        };
        return map[name] ?? Body.Sun;
    }
}
