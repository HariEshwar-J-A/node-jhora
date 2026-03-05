/**
 * Panchanga — Five Elements of the Vedic Almanac
 *
 * 1. Tithi     — Lunar day (Moon - Sun elongation, each 12°)
 * 2. Nakshatra — Lunar mansion (Moon / 13°20', 27 divisions)
 * 3. Yoga      — Luni-solar yoga (Moon + Sun, each 13°20')
 * 4. Karana    — Half-Tithi (each 6°, 11 types in a specific cycle)
 * 5. Vara      — Weekday from sunrise (not civil midnight)
 *
 * All angle arithmetic uses Decimal.js to eliminate IEEE-754 drift.
 */

import { Decimal } from 'decimal.js';
import { normalize360D, NAKSHATRA_SPAN_D, D, toNum } from '../core/precise.js';
import { DateTime } from 'luxon';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PanchangaResult {
    tithi:     { index: number; name: string; percent: number };
    nakshatra: { index: number; name: string; pada: number; percent: number };
    yoga:      { index: number; name: string };
    karana:    { index: number; name: string };
    vara:      { index: number; name: string };
}

// ---------------------------------------------------------------------------
// Named arrays
// ---------------------------------------------------------------------------

const NAKSHATRAS: string[] = [
    'Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra',
    'Punarvasu', 'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni',
    'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha',
    'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta',
    'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati',
];

const YOGAS: string[] = [
    'Vishkumbha', 'Priti', 'Ayushman', 'Saubhagya', 'Shobhana', 'Atiganda',
    'Sukarma', 'Dhriti', 'Shula', 'Ganda', 'Vriddhi', 'Dhruva', 'Vyaghata',
    'Harshana', 'Vajra', 'Siddhi', 'Vyatipata', 'Variyan', 'Parigha', 'Shiva',
    'Siddha', 'Sadhya', 'Shubha', 'Shukla', 'Brahma', 'Indra', 'Vaidhriti',
];

// Movable Karanas (7, cyclic): positions 2-57 in the 60-Karana cycle
const KARANAS_MOVABLE: string[] = [
    'Bava', 'Balava', 'Kaulava', 'Taitila', 'Gara', 'Vanija', 'Vishti',
];

const VARAS: string[] = [
    'Ravivara', 'Somavara', 'Mangalavara', 'Budhavara', 'Guruvara', 'Shukravara', 'Shanivara',
];

// ---------------------------------------------------------------------------
// Karana logic
// ---------------------------------------------------------------------------

/**
 * Determine Karana name from its sequential index (1-60).
 *
 * Standard Vedic Karana cycle (60 Karanas per lunar month):
 *   Position  1     : Kimstughna (fixed)
 *   Positions 2-57  : Cycle of 7 movable Karanas (repeating)
 *   Position 58     : Shakuni (fixed)
 *   Position 59     : Chatushpada (fixed)
 *   Position 60     : Naga (fixed)
 */
function karanaName(index: number): string {
    if (index === 1)  return 'Kimstughna';
    if (index === 58) return 'Shakuni';
    if (index === 59) return 'Chatushpada';
    if (index === 60) return 'Naga';
    // Movable cycle: positions 2-57 → map to KARANAS_MOVABLE[0-6]
    const cyclePos = (index - 2) % 7;
    return KARANAS_MOVABLE[cyclePos];
}

// ---------------------------------------------------------------------------
// Panchanga calculator
// ---------------------------------------------------------------------------

/**
 * Calculate the Panchanga for given solar and lunar sidereal longitudes.
 *
 * @param sunLong      Sun's sidereal longitude  [0, 360)
 * @param moonLong     Moon's sidereal longitude [0, 360)
 * @param date         Luxon DateTime (for Vara weekday)
 * @param sunriseHour  Decimal sunrise hour in local time (default 6.0).
 *                     If the current hour is before this, Vara shifts to the previous day.
 */
export function calculatePanchanga(
    sunLong:     number,
    moonLong:    number,
    date:        DateTime,
    sunriseHour: number = 6.0,
): PanchangaResult {

    const dSun  = new Decimal(sunLong);
    const dMoon = new Decimal(moonLong);
    const D12   = new Decimal(12);
    const D6    = new Decimal(6);

    // -------------------------------------------------------------------------
    // 1. Tithi — (Moon - Sun elongation) / 12, each Tithi = 12°
    // -------------------------------------------------------------------------
    const elongation  = normalize360D(dMoon.minus(dSun));
    const tithiVal    = elongation.div(D12);
    const tithiIdx    = tithiVal.floor().toNumber();              // 0-29
    const tithiIndex  = tithiIdx + 1;                             // 1-30
    const tithiPercent = toNum(tithiVal.minus(tithiIdx).times(100));

    let tithiName: string;
    if (tithiIndex === 15) {
        tithiName = 'Purnima';
    } else if (tithiIndex === 30) {
        tithiName = 'Amavasya';
    } else {
        const paksha   = tithiIndex <= 15 ? 'Shukla' : 'Krishna';
        const tithiNum = tithiIndex <= 15 ? tithiIndex : tithiIndex - 15;
        tithiName = `${paksha} ${tithiNum}`;
    }

    // -------------------------------------------------------------------------
    // 2. Nakshatra — Moon / (360/27)
    // -------------------------------------------------------------------------
    const nakVal    = dMoon.div(NAKSHATRA_SPAN_D);
    const nakIdx    = nakVal.floor().toNumber();                  // 0-26
    const nakPercent = toNum(nakVal.minus(nakIdx).times(100));
    const pada       = Math.floor(nakPercent / 25) + 1;          // 1-4

    // -------------------------------------------------------------------------
    // 3. Yoga — (Moon + Sun) / (360/27)
    // -------------------------------------------------------------------------
    const yogaSum = normalize360D(dMoon.plus(dSun));
    const yogaIdx = yogaSum.div(NAKSHATRA_SPAN_D).floor().toNumber(); // 0-26

    // -------------------------------------------------------------------------
    // 4. Karana — half-Tithi, sequential index 1-60
    //    Each 6° of elongation = one Karana
    // -------------------------------------------------------------------------
    const karanaSeq = elongation.div(D6).floor().toNumber() + 1; // 1-60

    // -------------------------------------------------------------------------
    // 5. Vara — weekday from sunrise
    // -------------------------------------------------------------------------
    // Luxon: weekday 1=Mon … 7=Sun. Vedic: 0=Sun, 1=Mon … 6=Sat.
    const luxonDay    = date.weekday; // 1-7
    let vedicWeekday  = luxonDay === 7 ? 0 : luxonDay; // 0=Sun, 1=Mon … 6=Sat

    const hour = date.hour + date.minute / 60;
    if (hour < sunriseHour) {
        // Before sunrise → previous Vedic day
        vedicWeekday = (vedicWeekday - 1 + 7) % 7;
    }

    // -------------------------------------------------------------------------
    // Result
    // -------------------------------------------------------------------------
    return {
        tithi: {
            index:   tithiIndex,
            name:    tithiName,
            percent: tithiPercent,
        },
        nakshatra: {
            index:   nakIdx + 1, // 1-27
            name:    NAKSHATRAS[nakIdx] ?? 'Unknown',
            pada,
            percent: nakPercent,
        },
        yoga: {
            index: yogaIdx + 1, // 1-27
            name:  YOGAS[yogaIdx] ?? 'Unknown',
        },
        karana: {
            index: karanaSeq,
            name:  karanaName(karanaSeq),
        },
        vara: {
            index: vedicWeekday,
            name:  VARAS[vedicWeekday],
        },
    };
}
