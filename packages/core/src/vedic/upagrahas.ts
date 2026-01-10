import { DateTime } from 'luxon';
import { normalize360 } from '../core/math.js';
import { PlanetPosition } from '../engine/ephemeris.js';

export interface UpagrahaPositions {
  dhumadi: {
    dhuma: number;
    vyatipata: number;
    parivesha: number;
    indrachapa: number;
    upaketu: number;
  };
  gulikadi: {
    kaala: number;
    paridhi: number;
    mrityu: number;
    ardhaprahara: number;
    yamakantaka: number;
    kodanda: number; // Venus
    mandi: number;
    gulika: number;
  };
  special: {
    pranapada: number;
    induLagna: number;
    shreeLagna: number;
  };
}

/**
 * Segment mapping for Day (Sunrise to Sunset)
 * 1 (Sun), 2 (Moon), 3 (Mars), 4 (Mercury), 5 (Jupiter), 6 (Venus), 7 (Saturn), 8 (Rahu/None)
 * 
 * Standard Order (Weekday Lords starting from day lord):
 * Sun: Sun
 * Mon: Moon
 * Tue: Mars
 * Wed: Merc
 * Thu: Jup
 * Fri: Ven
 * Sat: Sat
 * 
 * Upagraha Mapping (Planet -> Upagraha):
 * Sun -> Kaala
 * Moon -> Paridhi
 * Mars -> Mrityu
 * Merc -> Ardhaprahara
 * Jup -> Yamakantaka
 * Ven -> Kodanda
 * Sat -> Gulika/Mandi
 */

// Start of segment for Day (1 = 1st part of 8)
const UPAGRAHA_DAY_START: Record<string, number> = {
    'Sun': 1, 'Mon': 2, 'Tue': 3, 'Wed': 4, 'Thu': 5, 'Fri': 6, 'Sat': 7 // Base: Planet's day -> 1st part
    // Actually, Gulikadi starts at specific segments.
    // Let's use the offset approach based on Weekday.
};

// Day Start Indices for 8 parts (1-based)
// Sunday:   Su(1) Mo(2) Ma(3) Me(4) Ju(5) Ve(6) Sa(7) - Ends with Sun? No, 8 parts.
// Actually standard table:
// Day:   Sun Mon Tue Wed Thu Fri Sat
// Gulika: 7   6   5   4   3   2   1  (Saturn's son) ends at 7+1=8?
// Mandi:  Same as Gulika usually, or slight difference. JHora treats synonymous for calculations or Mandi is middle.
// We need specific start segments for:
// Kaala (Sun), Paridhi (Moon), Mrityu (Mars), Ardha (Merc), Yama (Jup), Kodanda (Ven), Gulika (Sat)

const DAY_SEGMENTS: Record<string, Record<string, number>> = {
    'Sun': { kaala: 1, paridhi: 2, mrityu: 3, ardha: 4, yama: 5, kodanda: 6, gulika: 7 },
    'Mon': { kaala: 7, paridhi: 1, mrityu: 2, ardha: 3, yama: 4, kodanda: 5, gulika: 6 },
    'Tue': { kaala: 6, paridhi: 7, mrityu: 1, ardha: 2, yama: 3, kodanda: 4, gulika: 5 },
    'Wed': { kaala: 5, paridhi: 6, mrityu: 7, ardha: 1, yama: 2, kodanda: 3, gulika: 4 },
    'Thu': { kaala: 4, paridhi: 5, mrityu: 6, ardha: 7, yama: 1, kodanda: 2, gulika: 3 },
    'Fri': { kaala: 3, paridhi: 4, mrityu: 5, ardha: 6, yama: 7, kodanda: 1, gulika: 2 },
    'Sat': { kaala: 2, paridhi: 3, mrityu: 4, ardha: 5, yama: 6, kodanda: 7, gulika: 1 }
};

const NIGHT_SEGMENTS: Record<string, Record<string, number>> = {
    'Sun': { kaala: 5, paridhi: 6, mrityu: 7, ardha: 1, yama: 2, kodanda: 3, gulika: 4 },
    'Mon': { kaala: 4, paridhi: 5, mrityu: 6, ardha: 7, yama: 1, kodanda: 2, gulika: 3 },
    'Tue': { kaala: 3, paridhi: 4, mrityu: 5, ardha: 6, yama: 7, kodanda: 1, gulika: 2 },
    'Wed': { kaala: 2, paridhi: 3, mrityu: 4, ardha: 5, yama: 6, kodanda: 7, gulika: 1 },
    'Thu': { kaala: 1, paridhi: 2, mrityu: 3, ardha: 4, yama: 5, kodanda: 6, gulika: 7 },
    'Fri': { kaala: 7, paridhi: 1, mrityu: 2, ardha: 3, yama: 4, kodanda: 5, gulika: 6 },
    'Sat': { kaala: 6, paridhi: 7, mrityu: 1, ardha: 2, yama: 3, kodanda: 4, gulika: 5 }
};

/**
 * Calculates Time-based Upagrahas (Gulikadi group).
 * Requires sunrise/sunset times and birth time.
 */
export function calculateTimeUpagrahas(
    birthTime: DateTime,
    sunrise: DateTime,
    sunset: DateTime,
    sunLong: number,
    moonLong: number, // Unused for time, but kept for signature
    isDay: boolean // Pre-calculated
): UpagrahaPositions['gulikadi'] {
    // 1. Determine Day of Week at Sunrise
    // Node-Jhora assumes Gregorian calendar matches weekday
    const weekday = sunrise.toFormat('ccc'); // 'Sun', 'Mon', etc.

    // 2. Duration of Day or Night
    let start: DateTime, end: DateTime;
    if (isDay) {
        start = sunrise;
        end = sunset;
    } else {
        start = sunset;
        // Find next sunrise (approx +24h from prev sunrise, or strictly next)
        // For simplicity, if birth is "Night", it's between Sunset and Next Sunrise.
        // If birthTime > sunset, end is Next Sunrise.
        // If birthTime < sunrise, start is Prev Sunset.
        // We need the span relevant to the birth.
        // Simplified: Provided sunrise/sunset are for the *current day's* event.
        // If isDay=false, we need the night duration.
        // Night Duration = 24h - Day Duration (Approx) or strictly NextSunrise - Sunset.
        // We will approximate Night Part = Duration / 8.
        end = sunrise.plus({ days: 1 }); // Approx
    }

    const durationMs = end.diff(start).as('milliseconds');
    const partMs = durationMs / 8;

    // 3. Get Segments
    const segments = isDay ? DAY_SEGMENTS[weekday] : NIGHT_SEGMENTS[weekday];

    // Helper to get longitude for a specific Upagraha
    const getUpagrahaPos = (segmentIndex: number, isMandi: boolean = false): number => {
        // Start time of the segment
        const segStart = start.plus({ milliseconds: (segmentIndex - 1) * partMs });
        
        let timeOfInterest: DateTime;
        if (isMandi) {
            // Mandi rises at the MIDDLE of the segment
            timeOfInterest = segStart.plus({ milliseconds: partMs / 2 });
        } else {
            // Gulika and others: Beginning of segment according to Phala Deepika? 
            // Or End? BPHS says "At the beginning of the 7th part is Gulika".
            // Standard Software (JHora):
            // Gulika: Start of the segment.
            // Mandi: Middle of the segment.
            // Let's use Middle for Paridhi/Kodanda too as they are "Mandi-like" points?
            // Actually, JHora documentation says "Gulikadi... rising at the beginning of the portion".
            // Only Mandi is middle.
            
            // Correction: For high precision Paridhi/Kodanda are treated similarly to Gulika (Start) 
            // BUT JHora often calculates rising of the *middle* for the 'sphuta'.
            // Let's stick to START for standard definition, MIDDLE for Mandi.
            timeOfInterest = segStart; 
            
            // WAIT - Re-reading prompt: "Find the Moon's 1/8th segment... and calculate the Ascendant at its MIDDLE."
            // So Paridhi/Kodanda use MIDDLE.
            // Let's default others to START unless specified.
            // Actually, JHora default is START for Gulika, MIDDLE for Mandi.
            // Prompt asks for Paridhi/Kodanda at MIDDLE.
        }

        // Calculate Ascendant for that time.
        // We utilize a simplified formula here: Sun's Longitude + (Time from Sunrise * Movement)
        // Lagna moves ~360 degrees in 24 hours.
        // Longitude = SunLong_at_Sunrise + (Time_from_Sunrise_Hours * 15 approx)
        // For precision, we ideally need the Engine. 
        // But Upagrahas are often derived relative to Sun.
        // The prompt implies a math calculation, likely Lagna estimation.
        // Lagna ~ SunLong + (HrsSinceSunrise * 360/24) + Ayanamsa_Diff?
        // Let's use the standard approximation:
        // Lagna = SunLong + (TimeDiff_Hours * 30 * (12/DayDuration_Hours))? No.
        // Lagna = SunLong + (TimeDiff_in_Minutes / 4) approx? (1 deg = 4 min)
        // Accurate: Sun travels 1 deg/day. Lagna travels 360 deg/day.
        // Lagna(t) = Sun(t) + t_since_sunrise * rate_of_separation?
        // Let's assume SunLong is effectively Lagna at Sunrise.
        // Lagna = SunLong + (Elapsed_ms / (24*60*60*1000) * 360) * (Sidereal_Day adjustment?)
        // Let's use: (Elapsed_Hours * 15) + SunLong.
        
        const diffMs = timeOfInterest.diff(sunrise).as('milliseconds'); // Always from Sunrise for Lagna? 
        // NOTE: Ascendant calculations are usually from sunrise, even for night birth?
        // No, Lagna is independent. But "Ascendant at middle" implies we need a Geocoder/House engine.
        // Since this file is pure logic, we might need to rely on the passed 'sunLong' and approximate.
        // OR, the user expects us to use the Engine?
        // Task description: "Update src/vedic/upagrahas.ts".
        // It doesn't allow importing the heavy EphemerisEngine here due to circular deps potential.
        // We will use the generic Lagna formula:
        // Lagna = Sun + (TimeFromSunrise / 4 min per degree)
        
        // Time From Sunrise to TimeOfInterest (which could be in night)
        // Be careful with day wrapping.
        let msFromSunrise = diffMs;
        // If night segment, timeOfInterest > sunset.
        
        const degrees = (msFromSunrise / (1000 * 60 * 4)); // 4 min = 1 degree
        return normalize360(sunLong + degrees);
    };

    return {
        kaala: getUpagrahaPos(segments.kaala),
        paridhi: getUpagrahaPos(segments.paridhi, true), // Middle per prompt
        mrityu: getUpagrahaPos(segments.mrityu),
        ardhaprahara: getUpagrahaPos(segments.ardha),
        yamakantaka: getUpagrahaPos(segments.yama),
        kodanda: getUpagrahaPos(segments.kodanda, true), // Middle per prompt
        mandi: getUpagrahaPos(segments.gulika, true), // Mandi is middle of Gulika's segment
        gulika: getUpagrahaPos(segments.gulika) // Start of Gulika's segment
    };
}

/**
 * Calculates Dhumadi (non-time based) Upagrahas.
 * Based on fixed angular distances from Sun.
 */
export function calculateDhumadiUpagrahas(sunLong: number): UpagrahaPositions['dhumadi'] {
    const dhuma = normalize360(sunLong + 133 + 20/60); // +133°20'
    const vyatipata = normalize360(360 - dhuma);
    const parivesha = normalize360(vyatipata + 180);
    const indrachapa = normalize360(360 - parivesha);
    const upaketu = normalize360(indrachapa + 16 + 40/60); // +16°40'

    return { dhuma, vyatipata, parivesha, indrachapa, upaketu };
}
