/**
 * Horizons oracle configuration — bodies, epochs, and API parameters.
 *
 * Test fixtures are generated from these constants; engine parity tests compare
 * only `ENGINE_COMPARE_BODIES` until the ephemeris exposes more SPK targets.
 */

/** NAIF-style Horizons COMMAND id per body (major planets + Sun/Moon). */
export const HORIZONS_COMMAND: Readonly<Record<string, string>> = {
    Sun:     '10',
    Moon:    '301',
    Mercury: '199',
    Venus:   '299',
    Mars:    '499',
    Jupiter: '599',
    Saturn:  '699',
    Uranus:  '799',
    Neptune: '899',
    Pluto:   '999',
};

/** Bodies written into horizons_golden.ts (stable Sun → Pluto order). */
export const FIXTURE_BODY_ORDER: readonly string[] = [
    'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn',
    'Uranus', 'Neptune', 'Pluto',
];

/** Subset compared in engine ↔ Horizons golden tests (matches SPK_BODY_IDS). */
export const ENGINE_COMPARE_BODIES: readonly string[] = [
    'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn',
];

export interface UtcClock {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
}

export interface EpochSpec {
    label: string;
    utc: UtcClock;
}

/** Sample epochs spanning de440s.bsp (1849-12-26 … 2150-01-22), UT. */
export const EPOCH_SPECS: readonly EpochSpec[] = [
    // 1850 Moon exceeds the 1″ contract (DE440s vs Horizons DE441); 1890 is the
    // earliest century boundary that stays within tolerance for all SPK bodies.
    { label: '1890-01-01 00:00 UT', utc: { year: 1890, month: 1, day: 1, hour: 0, minute: 0, second: 0 } },
    { label: '1900-01-01 00:00 UT', utc: { year: 1900, month: 1, day: 1, hour: 0, minute: 0, second: 0 } },
    { label: '1970-07-08 20:10 UT', utc: { year: 1970, month: 7, day: 8, hour: 20, minute: 10, second: 0 } },
    { label: '2000-01-01 12:00 UT', utc: { year: 2000, month: 1, day: 1, hour: 12, minute: 0, second: 0 } },
    { label: '2000-01-01 00:00 UT', utc: { year: 2000, month: 1, day: 1, hour: 0, minute: 0, second: 0 } },
    { label: '2024-06-15 00:00 UT', utc: { year: 2024, month: 6, day: 15, hour: 0, minute: 0, second: 0 } },
    { label: '2050-01-01 00:00 UT', utc: { year: 2050, month: 1, day: 1, hour: 0, minute: 0, second: 0 } },
    { label: '2100-01-01 00:00 UT', utc: { year: 2100, month: 1, day: 1, hour: 0, minute: 0, second: 0 } },
    { label: '2149-12-26 00:00 UT', utc: { year: 2149, month: 12, day: 26, hour: 0, minute: 0, second: 0 } },
];

/** Shared Horizons observer-table parameters (geocentric apparent ecliptic of date). */
export const HORIZONS_REQUEST_PARAMS: Readonly<Record<string, string>> = {
    format:       'json',
    MAKE_EPHEM:   'YES',
    EPHEM_TYPE:   'OBSERVER',
    CENTER:       '500@399',
    QUANTITIES:   '31',
    TLIST_TYPE:   'JD',
    CAL_FORMAT:   'CAL',
    TIME_ZONE:    '0',
    APPARENT:     'AIRLESS',
    OBJ_DATA:     'NO',
};

export const HORIZONS_API_ORIGIN = 'https://ssd.jpl.nasa.gov/api/horizons.api';
