/**
 * Historical calendar input — proleptic Julian before the Gregorian reform,
 * astronomical year numbering (year 0 = 1 BC), matching Swiss Ephemeris / JHora.
 *
 * Dates on and after 1582-10-15 use the Gregorian calendar. Earlier dates use
 * the proleptic Julian calendar (no historical discontinuity at the reform).
 */

export interface HistoricalDateTime {
    /** Astronomical year: 1 = 1 AD, 0 = 1 BC, -1 = 2 BC, … */
    astronomicalYear: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
}

const GREGORIAN_START = { y: 1582, m: 10, d: 15 };

export function historicalYearFromParts(
    year: number,
    era: 'astronomical' | 'historical' = 'astronomical',
): number {
    if (era === 'astronomical') return year;
    // historical: positive AD, BC as negative with no year 0
    if (year > 0) return year;
    return year + 1; // 1 BC → 0, 2 BC → -1
}

export function usesProlepticJulian(
    parts: Pick<HistoricalDateTime, 'astronomicalYear' | 'month' | 'day'>,
): boolean {
    const y = parts.astronomicalYear;
    if (y < GREGORIAN_START.y) return true;
    if (y > GREGORIAN_START.y) return false;
    if (parts.month < GREGORIAN_START.m) return true;
    if (parts.month > GREGORIAN_START.m) return false;
    return parts.day < GREGORIAN_START.d;
}

/**
 * Julian day (UT) at the given civil time, 0h = midnight.
 * Fractional part encodes time of day.
 */
export function julianDayUt(parts: HistoricalDateTime): number {
    const cal = usesProlepticJulian(parts) ? 'julian' : 'gregorian';
    let y = parts.astronomicalYear;
    let m = parts.month;
    if (m <= 2) {
        y -= 1;
        m += 12;
    }
    const A = cal === 'gregorian' ? Math.floor(y / 100) : 0;
    const B = cal === 'gregorian' ? 2 - A + Math.floor(A / 4) : 0;
    const jd =
        Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + parts.day + B - 1524.5;
    const frac = (parts.hour + (parts.minute + parts.second / 60) / 60) / 24;
    return jd + frac;
}

/**
 * Civil calendar date (astronomical year) of a Julian day — inverse of
 * {@link julianDayUt}. Gregorian from JD 2299160.5 (1582-10-15 0h), proleptic
 * Julian before. Valid for negative Julian days: the Julian-calendar branch is
 * shifted by whole 4-year cycles (1461 days) so the algorithm (Meeus,
 * *Astronomical Algorithms*, ch. 7) runs on a positive day count.
 */
export function civilDateFromJulianDay(
    jd: number,
): Pick<HistoricalDateTime, 'astronomicalYear' | 'month' | 'day'> & { dayFraction: number } {
    const z0 = Math.floor(jd + 0.5);
    const dayFraction = jd + 0.5 - z0;
    let z = z0;
    let cycles = 0;
    if (z < 0) {
        cycles = Math.ceil(-z / 1461) + 1;
        z += cycles * 1461;
    }
    let a = z;
    if (z0 >= 2299161) {
        const alpha = Math.floor((z - 1867216.25) / 36524.25);
        a = z + 1 + alpha - Math.floor(alpha / 4);
    }
    const b = a + 1524;
    const c = Math.floor((b - 122.1) / 365.25);
    const d = Math.floor(365.25 * c);
    const e = Math.floor((b - d) / 30.6001);
    const day = b - d - Math.floor(30.6001 * e);
    const month = e < 14 ? e - 1 : e - 13;
    const year = (month > 2 ? c - 4716 : c - 4715) - 4 * cycles;
    return { astronomicalYear: year, month, day, dayFraction };
}

/** Parse `YYYY-MM-DD` with astronomical year (0000 = 1 BC, -0001 = 2 BC). */
export function parseHistoricalDateString(
    date: string,
): Pick<HistoricalDateTime, 'astronomicalYear' | 'month' | 'day'> {
    const m = /^(-?\d{1,5})-(\d{2})-(\d{2})$/.exec(date);
    if (!m) throw new Error(`Invalid historical date "${date}" (expected astronomical YYYY-MM-DD)`);
    return {
        astronomicalYear: Number(m[1]),
        month: Number(m[2]),
        day: Number(m[3]),
    };
}

export function parseHistoricalTimeString(
    time: string,
): Pick<HistoricalDateTime, 'hour' | 'minute' | 'second'> {
    const m = /^(\d{2}):(\d{2}):(\d{2})$/.exec(time);
    if (!m) throw new Error(`Invalid time "${time}"`);
    return { hour: Number(m[1]), minute: Number(m[2]), second: Number(m[3]) };
}
