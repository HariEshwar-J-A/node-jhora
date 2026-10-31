import { DateTime } from 'luxon';

import { KalachakraDasha } from '../../src/dashas/kalachakra.js';
import {
    kalachakraPadaRow,
    KALACHAKRA_SIGN_YEARS,
    paramayusForNavamsaSign,
} from '../../src/dashas/kalachakra-tables.js';
import {
    DrigDasha,
    generateTithiAshtottari,
    MoolaDasha,
    PatyayiniDasha,
    SudasaDasha,
    tithiLordForElongation,
} from '../../src/dashas/special.js';
import { moolaDashaYearsForPlanet } from '../../src/dashas/jaimini-rasi-dasa.js';

describe('Kalachakra dasha', () => {
    test('paramayus triplicity matches BPHS v. 89', () => {
        expect(paramayusForNavamsaSign(0)).toBe(100);
        expect(paramayusForNavamsaSign(1)).toBe(85);
        expect(paramayusForNavamsaSign(2)).toBe(83);
        expect(paramayusForNavamsaSign(3)).toBe(86);
        expect(paramayusForNavamsaSign(8)).toBe(100);
    });

    test('nine sign years sum to paramayus for Ashwini pada 1 template', () => {
        const row = kalachakraPadaRow(0.5);
        const sum = row.signs.reduce((a, s) => a + KALACHAKRA_SIGN_YEARS[s]!, 0);
        expect(sum).toBe(row.paramayusYears);
    });

    test('schedule stays within one paramayus run', () => {
        const birth = DateTime.fromISO('1990-05-15T10:00:00+05:30');
        const res = KalachakraDasha.calculate(birth, 84.511);
        const covered = res.periods.reduce((a, p) => a + p.durationYears, 0);
        expect(covered).toBeLessThanOrEqual(res.paramayusYears + 1e-6);
        expect(res.periods.length).toBeGreaterThan(0);
    });
});

describe('Tithi Ashtottari', () => {
    test('Krishna Dwadasi maps to Mercury lord', () => {
        expect(tithiLordForElongation(11 * 12 + 5)).toBe('Mercury');
    });

    test('cycle totals 108 years', () => {
        const birth = DateTime.fromISO('1990-01-01T12:00:00Z');
        const periods = generateTithiAshtottari(birth, 100, 80, 1);
        const sum = periods.reduce((a, p) => a + p.durationYears, 0);
        expect(sum).toBeCloseTo(108, 0);
    });
});

describe('Patyayini dasha', () => {
    test('periods sum to sidereal year days', () => {
        const chart = {
            ascendant: 46.06,
            planets: [
                { name: 'Jupiter', longitude: 120, id: 5 },
                { name: 'Mercury', longitude: 200, id: 2 },
                { name: 'Moon', longitude: 310, id: 1 },
                { name: 'Sun', longitude: 350, id: 0 },
                { name: 'Venus', longitude: 10, id: 3 },
                { name: 'Mars', longitude: 40, id: 4 },
                { name: 'Saturn', longitude: 28.1152777777777, id: 6 },
            ],
        };
        const start = DateTime.fromISO('2024-01-01T00:00:00Z');
        const periods = PatyayiniDasha.calculate(chart, start);
        const sum = periods.reduce((a, p) => a + p.durationDays, 0);
        expect(sum).toBeCloseTo(365.256363, 3);
    });
});

describe('Moola dasha years', () => {
    test('Jupiter in Gemini → 10 years (Rath worked example)', () => {
        const years = moolaDashaYearsForPlanet('Jupiter', {
            name: 'Jupiter',
            longitude: 65,
            id: 5,
            latitude: 0,
            distance: 1,
            speed: 0,
            declination: 0,
        });
        expect(years).toBe(10);
    });
});

describe('Drig and Sudasa', () => {
    const planets = [
        { name: 'Sun', longitude: 10, id: 0, latitude: 0, distance: 1, speed: 1, declination: 0 },
        { name: 'Moon', longitude: 100, id: 1, latitude: 0, distance: 1, speed: 1, declination: 0 },
        { name: 'Mars', longitude: 200, id: 4, latitude: 0, distance: 1, speed: 1, declination: 0 },
    ];
    const chart = { ascendant: 15, planets };

    test('Drig emits nine mahadashas from Aries lagna', () => {
        const p = DrigDasha.calculate(chart, DateTime.fromISO('2000-01-01T00:00:00Z'), 1);
        expect(p.length).toBe(9);
    });

    test('Sudasa prorates first period from Śrī Lagna degree', () => {
        const p = SudasaDasha.calculate(chart, DateTime.fromISO('2000-01-01T00:00:00Z'), 100, 1);
        expect(p[0]!.durationYears).toBeLessThan(12);
    });
});
