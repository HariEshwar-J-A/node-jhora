/**
 * JHora parity fixture — twelve fictional reference charts.
 *
 * Provenance: Jagannatha Hora 8.0 GUI, screen-transcribed at 0.01″ display
 * precision. Settings: UserSelectedAyanamsa=17 (True Chitra), true nodes,
 * topocentric off, altitude 0 m. Preset `jhora-true-citra-geometric-true-node`.
 *
 * Per-body arcsecond tolerances are set from measured engine residuals at
 * commit 21d73f3 (see
 * packages/core/tests/fixtures/jhora12/jhora12-comparison.json). Moon on
 * Varanasi 2020 and Dallas 2024 uses a wider per-chart budget (ΔT ≈ 0.27 s).
 *
 * Regenerate: pnpm exec node tools/generate-jhora12-golden.mjs
 */

/** Degrees from a JHora "DD-MM-SS.ss" ayanamsa string. */
export function dms(deg: number, min: number, sec: number): number {
    return deg + min / 60 + sec / 3600;
}

/** Sign abbreviations as JHora prints them, in zodiacal order. */
const SIGN_BASE: Record<string, number> = {
    Ar: 0,
    Ta: 30,
    Ge: 60,
    Cn: 90,
    Le: 120,
    Vi: 150,
    Li: 180,
    Sc: 210,
    Sg: 240,
    Cp: 270,
    Aq: 300,
    Pi: 330,
};

/** Absolute longitude from a JHora body line. */
export function lon(
    deg: number,
    sign: keyof typeof SIGN_BASE | string,
    min: number,
    sec: number,
): number {
    return SIGN_BASE[sign] + deg + min / 60 + sec / 3600;
}

export const JHORA_CONVENTIONS = {
    ayanamsaMode: 27,
    positionMode: 'geometric' as const,
    nodeType: 'true' as const,
} as const;

export const JHORA_REFERENCE_CHART_ID = '2000-01-01_1200_Greenwich' as const;

export interface JhoraChartBody {
    name: string;
    printed: string;
    sign: number;
    longitude: number;
    retrograde?: boolean;
    toleranceArcsec: number;
}

export interface JhoraChartCase {
    id: string;
    place: string;
    utcOffsetHours: number;
    utc: { year: number; month: number; day: number; hour: number; minute: number; second: number };
    local: {
        year: number;
        month: number;
        day: number;
        hour: number;
        minute: number;
        second: number;
    };
    lat: number;
    lon: number;
    jd: number;
    /** Outside DE440s — requires NJCE441 chunks in CI. */
    needsDe441: boolean;
    ayanamsa: { printed: string; value: number; toleranceArcsec: number };
    ascendant: { printed: string; sign: number; longitude: number; toleranceArcsec: number };
    d1: JhoraChartBody[];
}

export const JHORA_CHARTS: readonly JhoraChartCase[] = [
    {
        id: '1600-05-01_1200_Rome',
        place: 'Rome, Italy',
        utcOffsetHours: 0.833056,
        utc: {
            year: 1600,
            month: 5,
            day: 1,
            hour: 11,
            minute: 10,
            second: 1,
        },
        local: {
            year: 1600,
            month: 5,
            day: 1,
            hour: 12,
            minute: 0,
            second: 0,
        },
        lat: 41.9028,
        lon: 12.4964,
        jd: 2305568.965289352,
        needsDe441: true,
        ayanamsa: {
            printed: '18-16-05.41',
            value: 18.268169444444442,
            toleranceArcsec: 0.02,
        },
        ascendant: {
            printed: '2 Le 26\' 30.27"',
            sign: 5,
            longitude: 122.44174166666667,
            toleranceArcsec: 0.02,
        },
        d1: [
            {
                name: 'Sun',
                printed: '22 Ar 54\' 12.06"',
                sign: 1,
                longitude: 22.90335,
                toleranceArcsec: 0.025099999999999997,
            },
            {
                name: 'Moon',
                printed: '26 Sc 50\' 40.34"',
                sign: 8,
                longitude: 236.8445388888889,
                toleranceArcsec: 0.0208,
            },
            {
                name: 'Mars',
                printed: '23 Cn 41\' 22.05"',
                sign: 4,
                longitude: 113.68945833333333,
                toleranceArcsec: 0.023,
            },
            {
                name: 'Mercury',
                printed: '9 Ta 14\' 29.30"',
                sign: 2,
                longitude: 39.24147222222222,
                toleranceArcsec: 0.02,
            },
            {
                name: 'Jupiter',
                printed: '24 Cn 23\' 12.83"',
                sign: 4,
                longitude: 114.38689722222223,
                toleranceArcsec: 0.0226,
            },
            {
                name: 'Venus',
                printed: '14 Pi 39\' 15.42"',
                sign: 12,
                longitude: 344.6542833333333,
                toleranceArcsec: 0.02,
            },
            {
                name: 'Saturn',
                printed: '5 Li 43\' 36.69"',
                sign: 7,
                longitude: 185.72685833333333,
                retrograde: true,
                toleranceArcsec: 0.0206,
            },
            {
                name: 'Rahu',
                printed: '5 Cp 31\' 24.56"',
                sign: 10,
                longitude: 275.5234888888889,
                toleranceArcsec: 0.02,
            },
            {
                name: 'Ketu',
                printed: '5 Cn 31\' 24.56"',
                sign: 4,
                longitude: 95.52348888888889,
                toleranceArcsec: 0.02,
            },
        ],
    },
    {
        id: '1800-08-15_1500_Cape-Town',
        place: 'Cape Town, South Africa',
        utcOffsetHours: 1.228333,
        utc: {
            year: 1800,
            month: 8,
            day: 15,
            hour: 13,
            minute: 46,
            second: 18,
        },
        local: {
            year: 1800,
            month: 8,
            day: 15,
            hour: 15,
            minute: 0,
            second: 0,
        },
        lat: -33.9249,
        lon: 18.4241,
        jd: 2378723.0738194445,
        needsDe441: true,
        ayanamsa: {
            printed: '21-03-35.56',
            value: 21.05987777777778,
            toleranceArcsec: 0.02,
        },
        ascendant: {
            printed: '1 Cp 18\' 58.47"',
            sign: 10,
            longitude: 271.31624166666666,
            toleranceArcsec: 0.0226,
        },
        d1: [
            {
                name: 'Sun',
                printed: '1 Le 20\' 45.06"',
                sign: 5,
                longitude: 121.34585,
                toleranceArcsec: 0.0276,
            },
            {
                name: 'Moon',
                printed: '5 Ge 24\' 47.86"',
                sign: 3,
                longitude: 65.41329444444445,
                toleranceArcsec: 0.0267,
            },
            {
                name: 'Mars',
                printed: '20 Ar 00\' 35.15"',
                sign: 1,
                longitude: 20.009763888888887,
                toleranceArcsec: 0.0259,
            },
            {
                name: 'Mercury',
                printed: '16 Le 57\' 22.94"',
                sign: 5,
                longitude: 136.9563722222222,
                retrograde: true,
                toleranceArcsec: 0.022699999999999998,
            },
            {
                name: 'Jupiter',
                printed: '1 Cn 06\' 51.00"',
                sign: 4,
                longitude: 91.11416666666666,
                toleranceArcsec: 0.030100000000000002,
            },
            {
                name: 'Venus',
                printed: '4 Le 10\' 08.75"',
                sign: 5,
                longitude: 124.16909722222222,
                toleranceArcsec: 0.0215,
            },
            {
                name: 'Saturn',
                printed: '23 Cn 54\' 22.70"',
                sign: 4,
                longitude: 113.90630555555556,
                toleranceArcsec: 0.0206,
            },
            {
                name: 'Rahu',
                printed: '29 Pi 17\' 09.79"',
                sign: 12,
                longitude: 359.2860527777778,
                toleranceArcsec: 0.0235,
            },
            {
                name: 'Ketu',
                printed: '29 Vi 17\' 09.79"',
                sign: 6,
                longitude: 179.28605277777777,
                toleranceArcsec: 0.0235,
            },
        ],
    },
    {
        id: '1900-03-15_0630_Delhi',
        place: 'New Delhi, India',
        utcOffsetHours: 5.147222,
        utc: {
            year: 1900,
            month: 3,
            day: 15,
            hour: 1,
            minute: 21,
            second: 10,
        },
        local: {
            year: 1900,
            month: 3,
            day: 15,
            hour: 6,
            minute: 30,
            second: 0,
        },
        lat: 28.6139,
        lon: 77.209,
        jd: 2415093.556365741,
        needsDe441: false,
        ayanamsa: {
            printed: '22-26-55.57',
            value: 22.448769444444444,
            toleranceArcsec: 0.024399999999999998,
        },
        ascendant: {
            printed: '7 Pi 07\' 05.45"',
            sign: 12,
            longitude: 337.11818055555557,
            toleranceArcsec: 0.025,
        },
        d1: [
            {
                name: 'Sun',
                printed: '1 Pi 34\' 36.70"',
                sign: 12,
                longitude: 331.5768611111111,
                toleranceArcsec: 0.022699999999999998,
            },
            {
                name: 'Moon',
                printed: '17 Le 34\' 27.00"',
                sign: 5,
                longitude: 137.57416666666666,
                toleranceArcsec: 0.0201,
            },
            {
                name: 'Mars',
                printed: '18 Aq 41\' 16.24"',
                sign: 11,
                longitude: 318.68784444444447,
                toleranceArcsec: 0.0276,
            },
            {
                name: 'Mercury',
                printed: '16 Pi 41\' 43.06"',
                sign: 12,
                longitude: 346.69529444444447,
                toleranceArcsec: 0.02,
            },
            {
                name: 'Jupiter',
                printed: '18 Sc 09\' 35.11"',
                sign: 8,
                longitude: 228.15975277777778,
                toleranceArcsec: 0.0271,
            },
            {
                name: 'Venus',
                printed: '12 Ar 33\' 47.78"',
                sign: 1,
                longitude: 12.563272222222222,
                toleranceArcsec: 0.022199999999999998,
            },
            {
                name: 'Saturn',
                printed: '11 Sg 50\' 33.38"',
                sign: 9,
                longitude: 251.84260555555556,
                toleranceArcsec: 0.02,
            },
            {
                name: 'Rahu',
                printed: '22 Sc 19\' 17.20"',
                sign: 8,
                longitude: 232.32144444444444,
                toleranceArcsec: 0.0254,
            },
            {
                name: 'Ketu',
                printed: '22 Ta 19\' 17.20"',
                sign: 2,
                longitude: 52.321444444444445,
                toleranceArcsec: 0.0254,
            },
        ],
    },
    {
        id: '1950-07-04_1845_New-York',
        place: 'New York, USA',
        utcOffsetHours: -4,
        utc: {
            year: 1950,
            month: 7,
            day: 4,
            hour: 22,
            minute: 45,
            second: 0,
        },
        local: {
            year: 1950,
            month: 7,
            day: 4,
            hour: 18,
            minute: 45,
            second: 0,
        },
        lat: 40.7128,
        lon: -74.006,
        jd: 2433467.4479166665,
        needsDe441: false,
        ayanamsa: {
            printed: '23-09-02.32',
            value: 23.150644444444442,
            toleranceArcsec: 0.0229,
        },
        ascendant: {
            printed: '25 Sc 59\' 09.16"',
            sign: 8,
            longitude: 235.98587777777777,
            toleranceArcsec: 0.02,
        },
        d1: [
            {
                name: 'Sun',
                printed: '19 Ge 12\' 52.95"',
                sign: 3,
                longitude: 79.21470833333333,
                toleranceArcsec: 0.0309,
            },
            {
                name: 'Moon',
                printed: '24 Aq 33\' 26.50"',
                sign: 11,
                longitude: 324.5573611111111,
                toleranceArcsec: 0.0276,
            },
            {
                name: 'Mars',
                printed: '16 Vi 45\' 14.14"',
                sign: 6,
                longitude: 166.7539277777778,
                toleranceArcsec: 0.0279,
            },
            {
                name: 'Mercury',
                printed: '11 Ge 44\' 19.59"',
                sign: 3,
                longitude: 71.738775,
                toleranceArcsec: 0.030100000000000002,
            },
            {
                name: 'Jupiter',
                printed: '14 Aq 11\' 58.11"',
                sign: 11,
                longitude: 314.199475,
                retrograde: true,
                toleranceArcsec: 0.0266,
            },
            {
                name: 'Venus',
                printed: '15 Ta 41\' 32.24"',
                sign: 2,
                longitude: 45.69228888888888,
                toleranceArcsec: 0.026299999999999997,
            },
            {
                name: 'Saturn',
                printed: '21 Le 32\' 01.88"',
                sign: 5,
                longitude: 141.53385555555556,
                toleranceArcsec: 0.0225,
            },
            {
                name: 'Rahu',
                printed: '8 Pi 37\' 15.30"',
                sign: 12,
                longitude: 338.6209166666667,
                toleranceArcsec: 0.028999999999999998,
            },
            {
                name: 'Ketu',
                printed: '8 Vi 37\' 15.30"',
                sign: 6,
                longitude: 158.6209166666667,
                toleranceArcsec: 0.028999999999999998,
            },
        ],
    },
    {
        id: '1975-11-20_2310_Tokyo',
        place: 'Tokyo, Japan',
        utcOffsetHours: 9,
        utc: {
            year: 1975,
            month: 11,
            day: 20,
            hour: 14,
            minute: 10,
            second: 0,
        },
        local: {
            year: 1975,
            month: 11,
            day: 20,
            hour: 23,
            minute: 10,
            second: 0,
        },
        lat: 35.6895,
        lon: 139.6917,
        jd: 2442737.090277778,
        needsDe441: false,
        ayanamsa: {
            printed: '23-30-17.31',
            value: 23.504808333333333,
            toleranceArcsec: 0.0286,
        },
        ascendant: {
            printed: '4 Le 24\' 45.46"',
            sign: 5,
            longitude: 124.41262777777779,
            toleranceArcsec: 0.030100000000000002,
        },
        d1: [
            {
                name: 'Sun',
                printed: '4 Sc 07\' 37.14"',
                sign: 8,
                longitude: 214.12698333333333,
                toleranceArcsec: 0.020999999999999998,
            },
            {
                name: 'Moon',
                printed: '23 Ta 20\' 19.23"',
                sign: 2,
                longitude: 53.338675,
                toleranceArcsec: 0.0258,
            },
            {
                name: 'Mars',
                printed: '7 Ge 43\' 19.15"',
                sign: 3,
                longitude: 67.72198611111111,
                retrograde: true,
                toleranceArcsec: 0.02,
            },
            {
                name: 'Mercury',
                printed: '29 Li 23\' 08.38"',
                sign: 7,
                longitude: 209.3856611111111,
                toleranceArcsec: 0.0224,
            },
            {
                name: 'Jupiter',
                printed: '21 Pi 55\' 17.52"',
                sign: 12,
                longitude: 351.92153333333334,
                retrograde: true,
                toleranceArcsec: 0.02,
            },
            {
                name: 'Venus',
                printed: '18 Vi 06\' 38.43"',
                sign: 6,
                longitude: 168.110675,
                toleranceArcsec: 0.020999999999999998,
            },
            {
                name: 'Saturn',
                printed: '9 Cn 26\' 09.83"',
                sign: 4,
                longitude: 99.4360638888889,
                retrograde: true,
                toleranceArcsec: 0.02,
            },
            {
                name: 'Rahu',
                printed: '28 Li 17\' 29.21"',
                sign: 7,
                longitude: 208.29144722222222,
                toleranceArcsec: 0.028999999999999998,
            },
            {
                name: 'Ketu',
                printed: '28 Ar 17\' 29.21"',
                sign: 1,
                longitude: 28.291447222222224,
                toleranceArcsec: 0.028999999999999998,
            },
        ],
    },
    {
        id: '1985-02-28_0405_Sydney',
        place: 'Sydney, Australia',
        utcOffsetHours: 11,
        utc: {
            year: 1985,
            month: 2,
            day: 27,
            hour: 17,
            minute: 5,
            second: 0,
        },
        local: {
            year: 1985,
            month: 2,
            day: 28,
            hour: 4,
            minute: 5,
            second: 0,
        },
        lat: -33.8688,
        lon: 151.2093,
        jd: 2446124.2118055555,
        needsDe441: false,
        ayanamsa: {
            printed: '23-38-03.22',
            value: 23.634227777777777,
            toleranceArcsec: 0.0303,
        },
        ascendant: {
            printed: '12 Cp 09\' 17.56"',
            sign: 10,
            longitude: 282.15487777777776,
            toleranceArcsec: 0.0316,
        },
        d1: [
            {
                name: 'Sun',
                printed: '15 Aq 26\' 03.23"',
                sign: 11,
                longitude: 315.4342305555556,
                toleranceArcsec: 0.0225,
            },
            {
                name: 'Moon',
                printed: '12 Ta 21\' 31.94"',
                sign: 2,
                longitude: 42.358872222222224,
                toleranceArcsec: 0.024599999999999997,
            },
            {
                name: 'Mars',
                printed: '25 Pi 01\' 20.08"',
                sign: 12,
                longitude: 355.0222444444444,
                toleranceArcsec: 0.028499999999999998,
            },
            {
                name: 'Mercury',
                printed: '22 Aq 43\' 10.03"',
                sign: 11,
                longitude: 322.71945277777775,
                toleranceArcsec: 0.0286,
            },
            {
                name: 'Jupiter',
                printed: '11 Cp 03\' 39.64"',
                sign: 10,
                longitude: 281.0610111111111,
                toleranceArcsec: 0.026,
            },
            {
                name: 'Venus',
                printed: '25 Pi 03\' 21.04"',
                sign: 12,
                longitude: 355.05584444444446,
                toleranceArcsec: 0.0294,
            },
            {
                name: 'Saturn',
                printed: '4 Sc 26\' 37.97"',
                sign: 8,
                longitude: 214.44388055555555,
                toleranceArcsec: 0.024599999999999997,
            },
            {
                name: 'Rahu',
                printed: '27 Ar 25\' 14.94"',
                sign: 1,
                longitude: 27.420816666666667,
                toleranceArcsec: 0.0223,
            },
            {
                name: 'Ketu',
                printed: '27 Li 25\' 14.94"',
                sign: 7,
                longitude: 207.42081666666667,
                toleranceArcsec: 0.0223,
            },
        ],
    },
    {
        id: '1990-06-21_1200_Reykjavik',
        place: 'Reykjavik, Iceland',
        timezone: 'UTC',
        utcOffsetHours: 0,
        utc: {
            year: 1990,
            month: 6,
            day: 21,
            hour: 12,
            minute: 0,
            second: 0,
        },
        local: {
            year: 1990,
            month: 6,
            day: 21,
            hour: 12,
            minute: 0,
            second: 0,
        },
        lat: 64.1466,
        lon: -21.9426,
        jd: 2448064,
        needsDe441: false,
        ayanamsa: {
            printed: '23-42-30.03',
            value: 23.708341666666666,
            toleranceArcsec: 0.0216,
        },
        ascendant: {
            printed: '23 Le 21\' 53.31"',
            sign: 5,
            longitude: 143.36480833333331,
            toleranceArcsec: 0.02,
        },
        d1: [
            {
                name: 'Sun',
                printed: '6 Ge 09\' 09.28"',
                sign: 3,
                longitude: 66.15257777777778,
                toleranceArcsec: 0.0223,
            },
            {
                name: 'Moon',
                printed: '18 Ta 03\' 14.18"',
                sign: 2,
                longitude: 48.05393888888889,
                toleranceArcsec: 0.0225,
            },
            {
                name: 'Mars',
                printed: '21 Pi 37\' 35.41"',
                sign: 12,
                longitude: 351.6265027777778,
                toleranceArcsec: 0.0312,
            },
            {
                name: 'Mercury',
                printed: '23 Ta 05\' 02.34"',
                sign: 2,
                longitude: 53.083983333333336,
                toleranceArcsec: 0.0308,
            },
            {
                name: 'Jupiter',
                printed: '23 Ge 29\' 41.23"',
                sign: 3,
                longitude: 83.49478611111111,
                toleranceArcsec: 0.0294,
            },
            {
                name: 'Venus',
                printed: '2 Ta 08\' 47.05"',
                sign: 2,
                longitude: 32.14640277777778,
                toleranceArcsec: 0.0287,
            },
            {
                name: 'Saturn',
                printed: '29 Sg 56\' 51.68"',
                sign: 9,
                longitude: 269.9476888888889,
                retrograde: true,
                toleranceArcsec: 0.0292,
            },
            {
                name: 'Rahu',
                printed: '14 Cp 05\' 20.37"',
                sign: 10,
                longitude: 284.08899166666663,
                toleranceArcsec: 0.02,
            },
            {
                name: 'Ketu',
                printed: '14 Cn 05\' 20.37"',
                sign: 4,
                longitude: 104.08899166666666,
                toleranceArcsec: 0.02,
            },
        ],
    },
    {
        id: '2000-01-01_1200_Greenwich',
        place: 'Greenwich, United Kingdom',
        timezone: 'UTC',
        utcOffsetHours: 0,
        utc: {
            year: 2000,
            month: 1,
            day: 1,
            hour: 12,
            minute: 0,
            second: 0,
        },
        local: {
            year: 2000,
            month: 1,
            day: 1,
            hour: 12,
            minute: 0,
            second: 0,
        },
        lat: 51.476852,
        lon: -0.0005,
        jd: 2451545,
        needsDe441: false,
        ayanamsa: {
            printed: '23-50-28.91',
            value: 23.84136388888889,
            toleranceArcsec: 0.0358,
        },
        ascendant: {
            printed: '0 Ar 25\' 21.84"',
            sign: 1,
            longitude: 0.42273333333333335,
            toleranceArcsec: 0.0339,
        },
        d1: [
            {
                name: 'Sun',
                printed: '16 Sg 32\' 13.97"',
                sign: 9,
                longitude: 256.5372138888889,
                toleranceArcsec: 0.0291,
            },
            {
                name: 'Moon',
                printed: '19 Li 29\' 11.20"',
                sign: 7,
                longitude: 199.48644444444443,
                toleranceArcsec: 0.027,
            },
            {
                name: 'Mars',
                printed: '4 Aq 08\' 02.74"',
                sign: 11,
                longitude: 304.13409444444443,
                toleranceArcsec: 0.0265,
            },
            {
                name: 'Mercury',
                printed: '8 Sg 03\' 52.24"',
                sign: 9,
                longitude: 248.06451111111113,
                toleranceArcsec: 0.026799999999999997,
            },
            {
                name: 'Jupiter',
                printed: '1 Ar 25\' 00.06"',
                sign: 1,
                longitude: 1.4166833333333335,
                toleranceArcsec: 0.023899999999999998,
            },
            {
                name: 'Venus',
                printed: '7 Sc 44\' 10.46"',
                sign: 8,
                longitude: 217.73623888888886,
                toleranceArcsec: 0.0282,
            },
            {
                name: 'Saturn',
                printed: '16 Ar 33\' 25.83"',
                sign: 1,
                longitude: 16.557175,
                retrograde: true,
                toleranceArcsec: 0.0266,
            },
            {
                name: 'Rahu',
                printed: '10 Cn 06\' 59.89"',
                sign: 4,
                longitude: 100.1166361111111,
                toleranceArcsec: 0.03,
            },
            {
                name: 'Ketu',
                printed: '10 Cp 06\' 59.89"',
                sign: 10,
                longitude: 280.1166361111111,
                toleranceArcsec: 0.03,
            },
        ],
    },
    {
        id: '2010-09-09_0909_Nairobi',
        place: 'Nairobi, Kenya',
        utcOffsetHours: 3,
        utc: {
            year: 2010,
            month: 9,
            day: 9,
            hour: 6,
            minute: 9,
            second: 0,
        },
        local: {
            year: 2010,
            month: 9,
            day: 9,
            hour: 9,
            minute: 9,
            second: 0,
        },
        lat: -1.2864,
        lon: 36.8172,
        jd: 2455448.75625,
        needsDe441: false,
        ayanamsa: {
            printed: '23-59-25.92',
            value: 23.990533333333335,
            toleranceArcsec: 0.02,
        },
        ascendant: {
            printed: '5 Li 35\' 49.77"',
            sign: 7,
            longitude: 185.59715833333334,
            toleranceArcsec: 0.02,
        },
        d1: [
            {
                name: 'Sun',
                printed: '22 Le 29\' 01.34"',
                sign: 5,
                longitude: 142.48370555555553,
                toleranceArcsec: 0.0258,
            },
            {
                name: 'Moon',
                printed: '4 Vi 11\' 28.22"',
                sign: 6,
                longitude: 154.19117222222224,
                toleranceArcsec: 0.0275,
            },
            {
                name: 'Mars',
                printed: '2 Li 14\' 08.91"',
                sign: 7,
                longitude: 182.23580833333332,
                toleranceArcsec: 0.025500000000000002,
            },
            {
                name: 'Mercury',
                printed: '12 Le 22\' 45.61"',
                sign: 5,
                longitude: 132.37933611111112,
                retrograde: true,
                toleranceArcsec: 0.026299999999999997,
            },
            {
                name: 'Jupiter',
                printed: '5 Pi 59\' 41.04"',
                sign: 12,
                longitude: 335.99473333333333,
                retrograde: true,
                toleranceArcsec: 0.0276,
            },
            {
                name: 'Venus',
                printed: '6 Li 27\' 47.20"',
                sign: 7,
                longitude: 186.4631111111111,
                toleranceArcsec: 0.024399999999999998,
            },
            {
                name: 'Saturn',
                printed: '11 Vi 05\' 59.44"',
                sign: 6,
                longitude: 161.09984444444444,
                toleranceArcsec: 0.026,
            },
            {
                name: 'Rahu',
                printed: '15 Sg 33\' 06.85"',
                sign: 9,
                longitude: 255.5519027777778,
                toleranceArcsec: 0.0204,
            },
            {
                name: 'Ketu',
                printed: '15 Ge 33\' 06.85"',
                sign: 3,
                longitude: 75.55190277777777,
                toleranceArcsec: 0.0204,
            },
        ],
    },
    {
        id: '2020-12-21_1820_Varanasi',
        place: 'Varanasi, India',
        utcOffsetHours: 5.5,
        utc: {
            year: 2020,
            month: 12,
            day: 21,
            hour: 12,
            minute: 50,
            second: 0,
        },
        local: {
            year: 2020,
            month: 12,
            day: 21,
            hour: 18,
            minute: 20,
            second: 0,
        },
        lat: 25.3176,
        lon: 82.9739,
        jd: 2459205.034722222,
        needsDe441: false,
        ayanamsa: {
            printed: '24-08-02.71',
            value: 24.13408611111111,
            toleranceArcsec: 0.0371,
        },
        ascendant: {
            printed: '21 Ge 49\' 38.04"',
            sign: 3,
            longitude: 81.82723333333333,
            toleranceArcsec: 0.0343,
        },
        d1: [
            {
                name: 'Sun',
                printed: '5 Sg 59\' 41.87"',
                sign: 9,
                longitude: 245.99496388888886,
                toleranceArcsec: 0.02,
            },
            {
                name: 'Moon',
                printed: '0 Pi 57\' 24.53"',
                sign: 12,
                longitude: 330.95681388888886,
                toleranceArcsec: 0.2,
            },
            {
                name: 'Mars',
                printed: '28 Pi 59\' 54.34"',
                sign: 12,
                longitude: 358.9984277777778,
                toleranceArcsec: 0.0219,
            },
            {
                name: 'Mercury',
                printed: '6 Sg 47\' 21.82"',
                sign: 9,
                longitude: 246.78939444444444,
                toleranceArcsec: 0.02,
            },
            {
                name: 'Jupiter',
                printed: '6 Cp 18\' 49.18"',
                sign: 10,
                longitude: 276.3136611111111,
                toleranceArcsec: 0.0208,
            },
            {
                name: 'Venus',
                printed: '13 Sc 11\' 48.88"',
                sign: 8,
                longitude: 223.19691111111112,
                toleranceArcsec: 0.02,
            },
            {
                name: 'Saturn',
                printed: '6 Cp 20\' 18.90"',
                sign: 10,
                longitude: 276.3385833333333,
                toleranceArcsec: 0.0283,
            },
            {
                name: 'Rahu',
                printed: '25 Ta 44\' 42.57"',
                sign: 2,
                longitude: 55.745158333333336,
                toleranceArcsec: 0.0237,
            },
            {
                name: 'Ketu',
                printed: '25 Sc 44\' 42.57"',
                sign: 8,
                longitude: 235.7451583333333,
                toleranceArcsec: 0.0237,
            },
        ],
    },
    {
        id: '2024-04-08_1318_Dallas',
        place: 'Dallas, USA',
        utcOffsetHours: -5,
        utc: {
            year: 2024,
            month: 4,
            day: 8,
            hour: 18,
            minute: 18,
            second: 0,
        },
        local: {
            year: 2024,
            month: 4,
            day: 8,
            hour: 13,
            minute: 18,
            second: 0,
        },
        lat: 32.7767,
        lon: -96.797,
        jd: 2460409.2625,
        needsDe441: false,
        ayanamsa: {
            printed: '24-10-48.37',
            value: 24.18010277777778,
            toleranceArcsec: 0.0214,
        },
        ascendant: {
            printed: '3 Cn 03\' 10.90"',
            sign: 4,
            longitude: 93.05302777777777,
            toleranceArcsec: 0.02,
        },
        d1: [
            {
                name: 'Sun',
                printed: '25 Pi 13\' 32.35"',
                sign: 12,
                longitude: 355.2256527777777,
                toleranceArcsec: 0.0286,
            },
            {
                name: 'Moon',
                printed: '25 Pi 11\' 37.53"',
                sign: 12,
                longitude: 355.19375833333334,
                toleranceArcsec: 0.2,
            },
            {
                name: 'Mars',
                printed: '18 Aq 52\' 50.16"',
                sign: 11,
                longitude: 318.8806,
                toleranceArcsec: 0.027,
            },
            {
                name: 'Mercury',
                printed: '0 Ar 37\' 05.52"',
                sign: 1,
                longitude: 0.6182000000000001,
                retrograde: true,
                toleranceArcsec: 0.0253,
            },
            {
                name: 'Jupiter',
                printed: '24 Ar 52\' 27.11"',
                sign: 1,
                longitude: 24.87419722222222,
                toleranceArcsec: 0.02,
            },
            {
                name: 'Venus',
                printed: '10 Pi 16\' 33.26"',
                sign: 12,
                longitude: 340.27590555555554,
                toleranceArcsec: 0.030199999999999998,
            },
            {
                name: 'Saturn',
                printed: '20 Aq 16\' 58.65"',
                sign: 11,
                longitude: 320.28295833333334,
                toleranceArcsec: 0.02,
            },
            {
                name: 'Rahu',
                printed: '21 Pi 26\' 53.68"',
                sign: 12,
                longitude: 351.44824444444447,
                toleranceArcsec: 0.02,
            },
            {
                name: 'Ketu',
                printed: '21 Vi 26\' 53.68"',
                sign: 6,
                longitude: 171.44824444444444,
                toleranceArcsec: 0.02,
            },
        ],
    },
    {
        id: '2100-01-01_0000_Honolulu',
        place: 'Honolulu, USA',
        utcOffsetHours: -10,
        utc: {
            year: 2100,
            month: 1,
            day: 1,
            hour: 10,
            minute: 0,
            second: 0,
        },
        local: {
            year: 2100,
            month: 1,
            day: 1,
            hour: 0,
            minute: 0,
            second: 0,
        },
        lat: 21.3069,
        lon: -157.8583,
        jd: 2488069.9166666665,
        needsDe441: false,
        ayanamsa: {
            printed: '25-14-14.55',
            value: 25.237375,
            toleranceArcsec: 0.0314,
        },
        ascendant: {
            printed: '7 Vi 49\' 54.11"',
            sign: 6,
            longitude: 157.83169722222223,
            toleranceArcsec: 0.0349,
        },
        d1: [
            {
                name: 'Sun',
                printed: '15 Sg 47\' 52.55"',
                sign: 9,
                longitude: 255.79793055555555,
                toleranceArcsec: 0.0276,
            },
            {
                name: 'Moon',
                printed: '18 Le 02\' 24.30"',
                sign: 5,
                longitude: 138.04008333333334,
                toleranceArcsec: 0.028499999999999998,
            },
            {
                name: 'Mars',
                printed: '4 Ar 27\' 34.84"',
                sign: 1,
                longitude: 4.459677777777778,
                toleranceArcsec: 0.032600000000000004,
            },
            {
                name: 'Mercury',
                printed: '23 Sg 27\' 34.81"',
                sign: 9,
                longitude: 263.45966944444444,
                toleranceArcsec: 0.0208,
            },
            {
                name: 'Jupiter',
                printed: '26 Vi 00\' 56.25"',
                sign: 6,
                longitude: 176.015625,
                toleranceArcsec: 0.02,
            },
            {
                name: 'Venus',
                printed: '25 Cp 20\' 34.92"',
                sign: 10,
                longitude: 295.3430333333333,
                toleranceArcsec: 0.0281,
            },
            {
                name: 'Saturn',
                printed: '0 Li 25\' 14.61"',
                sign: 7,
                longitude: 180.420725,
                toleranceArcsec: 0.0296,
            },
            {
                name: 'Rahu',
                printed: '24 Aq 35\' 21.01"',
                sign: 11,
                longitude: 324.58916944444445,
                toleranceArcsec: 0.034,
            },
            {
                name: 'Ketu',
                printed: '24 Le 35\' 21.01"',
                sign: 5,
                longitude: 144.58916944444445,
                toleranceArcsec: 0.034,
            },
        ],
    },
] as const;

/** Primary chart for convention / varga / panchanga regression tests. */
export const JHORA_BIRTH = (() => {
    const c = JHORA_CHARTS.find((x) => x.id === JHORA_REFERENCE_CHART_ID)!;
    return {
        local: { ...c.local, utcOffset: c.utcOffsetHours },
        utc: c.utc,
        lat: c.lat,
        lon: c.lon,
        jd: c.jd,
    };
})();

export const JHORA_AYANAMSA = (() => {
    const c = JHORA_CHARTS.find((x) => x.id === JHORA_REFERENCE_CHART_ID)!;
    return { ...c.ayanamsa, mode: 27 as const };
})();

export const JHORA_D1 = JHORA_CHARTS.find((x) => x.id === JHORA_REFERENCE_CHART_ID)!.d1;
export const JHORA_ASCENDANT = JHORA_CHARTS.find(
    (x) => x.id === JHORA_REFERENCE_CHART_ID,
)!.ascendant;
// ---------------------------------------------------------------------------
// Reference chart (Greenwich J2000) — varga / panchanga / dasha regression
// Engine snapshot; D1 for this chart is pinned to JHora screen transcription above.
// ---------------------------------------------------------------------------

export const JHORA_SIDEREAL_TIME = {
    printed: 'engine@main',
    hours: 18.69710497151968,
    toleranceSeconds: 2,
} as const;

export const JHORA_D9 = [
    {
        name: 'Sun',
        printed: 'engine@main',
        sign: 5,
        longitude: 148.8349601264025,
        toleranceArcsec: 9,
    },
    {
        name: 'Moon',
        printed: 'engine@main',
        sign: 12,
        longitude: 355.3780298919021,
        toleranceArcsec: 9,
    },
    {
        name: 'Mars',
        printed: 'engine@main',
        sign: 8,
        longitude: 217.2068786977002,
        toleranceArcsec: 9,
    },
    {
        name: 'Mercury',
        printed: 'engine@main',
        sign: 3,
        longitude: 72.58062957507126,
        toleranceArcsec: 9,
    },
    {
        name: 'Jupiter',
        printed: 'engine@main',
        sign: 1,
        longitude: 12.750172363875663,
        toleranceArcsec: 9,
    },
    {
        name: 'Venus',
        printed: 'engine@main',
        sign: 6,
        longitude: 159.62618289650743,
        toleranceArcsec: 9,
    },
    {
        name: 'Saturn',
        printed: 'engine@main',
        sign: 5,
        longitude: 149.01460411039295,
        toleranceArcsec: 9,
    },
    {
        name: 'Rahu',
        printed: 'engine@main',
        sign: 7,
        longitude: 181.049762604494,
        toleranceArcsec: 18,
    },
    {
        name: 'Ketu',
        printed: 'engine@main',
        sign: 1,
        longitude: 1.0497626044938,
        toleranceArcsec: 18,
    },
] as const;

export const JHORA_D9_ASCENDANT = {
    printed: 'engine@main',
    sign: 1,
    longitude: 3.8046472072239226,
    toleranceArcsec: 9,
} as const;

export const JHORA_PANCHANGA = {
    tithi: { name: 'Krishna 11', index: 26, percentLeft: 75.42 },
    nakshatra: { name: 'Swati', index: 15, pada: 4, percentLeft: 3.85 },
    yoga: { name: 'Dhriti', percentLeft: 100 },
    karana: { name: 'Bava', percentLeft: 100 },
    vara: { name: 'Shanivara', index: 6 },
    tolerancePercent: 0.02,
} as const;

export const JHORA_DASHA = {
    startLord: 'Rahu',
    boundaries: [
        {
            lord: 'Rahu',
            endsOn: '2000-09-10',
        },
        {
            lord: 'Jupiter',
            endsOn: '2016-09-10',
        },
        {
            lord: 'Saturn',
            endsOn: '2035-09-11',
        },
        {
            lord: 'Mercury',
            endsOn: '2052-09-11',
        },
        {
            lord: 'Ketu',
            endsOn: '2059-09-11',
        },
        {
            lord: 'Venus',
            endsOn: '2079-09-11',
        },
        {
            lord: 'Sun',
            endsOn: '2085-09-11',
        },
        {
            lord: 'Moon',
            endsOn: '2095-09-12',
        },
        {
            lord: 'Mars',
            endsOn: '2102-09-12',
        },
    ],
    toleranceDays: 3,
} as const;

export const JHORA_D10_SCHEME = 'jhora_5_8' as const;
export const JHORA_D10_LABEL = 'D-10 (5-8)';

export const JHORA_D10 = [
    {
        name: 'Sun',
        printed: 'engine@main',
        sign: 2,
        longitude: 45.372177918225,
        toleranceArcsec: 10,
    },
    {
        name: 'Moon',
        printed: 'engine@main',
        sign: 1,
        longitude: 14.864477657669,
        toleranceArcsec: 10,
    },
    {
        name: 'Mars',
        printed: 'engine@main',
        sign: 12,
        longitude: 341.340976330778,
        toleranceArcsec: 10,
    },
    {
        name: 'Mercury',
        printed: 'engine@main',
        sign: 11,
        longitude: 320.6451439723014,
        toleranceArcsec: 10,
    },
    {
        name: 'Jupiter',
        printed: 'engine@main',
        sign: 1,
        longitude: 14.16685818208407,
        toleranceArcsec: 10,
    },
    {
        name: 'Venus',
        printed: 'engine@main',
        sign: 10,
        longitude: 282.6375745594362,
        toleranceArcsec: 10,
    },
    {
        name: 'Saturn',
        printed: 'engine@main',
        sign: 6,
        longitude: 165.57178234488106,
        toleranceArcsec: 10,
    },
    {
        name: 'Rahu',
        printed: 'engine@main',
        sign: 5,
        longitude: 138.8335971061178,
        toleranceArcsec: 20,
    },
    {
        name: 'Ketu',
        printed: 'engine@main',
        sign: 11,
        longitude: 318.833597106118,
        toleranceArcsec: 20,
    },
] as const;

export const JHORA_D10_ASCENDANT = {
    printed: 'engine@main',
    sign: 1,
    longitude: 4.227385785804358,
    toleranceArcsec: 10,
} as const;

export const JHORA_D10_EVEN_SIGN_BODIES = ['Venus', 'Rahu', 'Ketu'] as const;
