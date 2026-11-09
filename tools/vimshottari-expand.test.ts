import { DateTime } from 'luxon';
import { generateVimshottari } from '../packages/prediction/src/dasha.ts';
import {
    DASHA_DURATIONS,
    expandVimshottariLevel,
    type VimPeriod,
} from '../apps/web/src/lib/vimshottari-expand.ts';

function fromEngine(period: {
    planet: string;
    level: number;
    start: DateTime;
    end: DateTime;
    durationYears: number;
    standardYears: number;
}): VimPeriod {
    return {
        planet: period.planet,
        level: period.level,
        start: period.start.toISO()!,
        end: period.end.toISO()!,
        durationYears: period.durationYears,
        standardYears: period.standardYears,
    };
}

describe('expandVimshottariLevel', () => {
    const birth = DateTime.fromISO('2000-01-01T12:00:00', { zone: 'Asia/Kolkata' });
    const moon = 123.456;

    it('matches generateVimshottari for antar and pratyantar', () => {
        const maha = generateVimshottari(birth, moon, 1);
        const depth3 = generateVimshottari(birth, moon, 3);
        expect(maha.length).toBeGreaterThan(0);
        maha.forEach((period, index) => {
            const expanded = expandVimshottariLevel(
                fromEngine({
                    planet: period.planet,
                    level: 1,
                    start: period.start,
                    end: period.end,
                    durationYears: period.durationYears,
                    standardYears: DASHA_DURATIONS[period.planet]!,
                }),
            );
            const expected = depth3[index]!.subPeriods ?? [];
            expect(expanded.map((row) => row.planet)).toEqual(expected.map((row) => row.planet));
            expanded.forEach((row, sub) => {
                const want = expected[sub]!;
                expect(Math.abs(Date.parse(row.start) - want.start.toMillis())).toBeLessThan(2000);
                expect(Math.abs(Date.parse(row.end) - want.end.toMillis())).toBeLessThan(2000);
                const deeper = expandVimshottariLevel(row);
                const wantDeeper = want.subPeriods ?? [];
                expect(deeper.map((item) => item.planet)).toEqual(
                    wantDeeper.map((item) => item.planet),
                );
            });
        });
    });
});
