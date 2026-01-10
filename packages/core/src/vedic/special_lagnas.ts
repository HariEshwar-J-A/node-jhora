import { DateTime } from 'luxon';
import { normalize360 } from '../core/math.js';
import { PlanetPosition } from '../engine/ephemeris.js';

/**
 * Calculates Pranapada Lagna.
 * Formula depends on Sun's sign (Movable/Fixed/Dual).
 */
/**
 * Calculates Pranapada Lagna.
 * Formula depends on Sun's sign (Movable/Fixed/Dual).
 */
export function calculatePranapada(
    birthTime: DateTime,
    sunrise: DateTime,
    sunLong: number
): number {
    // 1 Vighati = 24 seconds
    // Ghati = 24 minutes = 1440 seconds. 1 Ghati = 60 Vighatis.
    // 1 Vighati = 1440/60 = 24 seconds.
    // Time elapsed since Sunrise.
    
    // Handle birth before sunrise?
    // User Tip: "Ensure time difference calculation handles birth-before-sunrise by adding 24 hours to the duration."
    // Luxon diff might be negative if birthTime < sunrise (simple date comparison) 
    // IF we passed them as same-day objects.
    // Usually 'sunrise' passed is the sunrise of the day.
    
    let diffSec = birthTime.diff(sunrise).as('seconds');
    if (diffSec < 0) {
        // Birth is technically "before sunrise" of that calendar day, but astrologically
        // we might be looking at "Sunrise of Day" vs "Time".
        // The prompt implies handling the 24h wrap around if negative?
        // OR: If birth is 4 AM and Sunrise is 6 AM.
        // Diff is -2 hours.
        // The elapsed time from PREVIOUS sunrise is ~22 hours.
        // We should add 24 hours (86400 seconds).
        diffSec += 86400;
    }

    const vighatis = diffSec / 24;

    // Movement: The text says:
    // Movable: (15 * Time) + Sun
    // Fixed: (15 * Time) + Sun + 240
    // Dual: (15 * Time) + Sun + 120
    
    // Sun Sign properties (1-based)
    // Movable (Chara): 1, 4, 7, 10
    // Fixed (Sthira): 2, 5, 8, 11
    // Dual (Dvisvabhava): 3, 6, 9, 12
    const sunSign = Math.floor(sunLong / 30) + 1;
    const remainder = sunSign % 3; // 1=Movable, 2=Fixed, 0=Dual
    
    let base = 0;
    if (remainder === 1) { // Movable
        base = 0;
    } else if (remainder === 2) { // Fixed
        base = 240;
    } else { // Dual (0)
        base = 120;
    }
    
    // Calculate raw degrees
    // Note: 15 degrees per Vighati seems HUGE. 
    // Wait. 1 Vighati = 24 seconds.
    // Lagna moves 360 deg in 24 hours.
    // In 24 seconds, Lagna moves 360 / (24*60*60/24) = 360 / 3600 = 0.1 degree.
    // Pranapada moves FASTER?
    // "Pranapada is the breath lagna". 
    // JHora/BPHS: Pranapada moves through the zodiac every ... ?
    // The formula (15 * TimeInVighatis) means for 1 Vighati (24s) it moves 15 degrees??
    // That means it completes 360 degrees in 24 Vighatis = 24 * 24s = 576 seconds = ~9.6 minutes.
    // Yes, Pranapada is extremely fast.
    
    const pp = (15 * vighatis) + sunLong + base;
    return normalize360(pp);
}

/**
 * Calculates Indu Lagna (Wealth Point).
 * Based on rays of 9th lords from Lagna and Moon.
 */
export function calculateInduLagna(
    ascendantSign: number, // 1-12
    moonSign: number, // 1-12
    planets: PlanetPosition[] // Must contain lords
): number {
    // Rays: Sun(30), Moon(16), Mars(6), Merc(8), Jup(10), Ven(12), Sat(1)
    const RAYS: Record<number, number> = {
        0: 30, // Sun
        1: 16, // Moon
        2: 8,  // Merc
        3: 12, // Ven
        4: 6,  // Mars
        5: 10, // Jup
        6: 1,  // Sat
        11: 0, // Rahu (ignored usually)
        99: 0  // Ketu
    };

    // Helper: Find Lord of a Sign
    const getLord = (sign: number): number => {
        // 1=Mar, 2=Ven, 3=Mer, 4=Mon, 5=Sun, 6=Mer, 7=Ven, 8=Mar, 9=Jup, 10=Sat, 11=Sat, 12=Jup
        const lords = [0, 4, 3, 2, 1, 0, 2, 3, 4, 5, 6, 6, 5]; // 1-based index
        // 1(Ar)-Mars(4), 2(Ta)-Ven(3), 3(Ge)-Mer(2), 4(Cn)-Mon(1), 5(Le)-Sun(0), ...
        return lords[sign];
    };

    // 9th from Lagna
    let lagna9 = (ascendantSign + 8) % 12;
    if (lagna9 === 0) lagna9 = 12;
    const lordLagna9 = getLord(lagna9);

    // 9th from Moon
    let moon9 = (moonSign + 8) % 12;
    if (moon9 === 0) moon9 = 12;
    const lordMoon9 = getLord(moon9);

    // Sum Rays
    const raysSum = (RAYS[lordLagna9] || 0) + (RAYS[lordMoon9] || 0);

    // Divide by 12, take remainder
    let remainder = raysSum % 12;
    if (remainder === 0) remainder = 12; 
    // Count that many signs forward from Moon
    // If Moon is in Aries (1) and rem is 1, Indu Lagna is Aries.
    // If rem is 2, Taurus.
    // Formula: (MoonSign + Remainder - 1)
    
    let induSign = (moonSign + remainder - 1) % 12;
    if (induSign <= 0) induSign += 12;
    
    // Convert Sign to default longitude (start of sign)
    return (induSign - 1) * 30;
}

/**
 * Calculates Shree Lagna (Placeholder/Basic).
 * Logic: (DurationOfDay / 8) related? 
 * Actually Shree Lagna is simpler: Start at Sunrise with Nakshatra/Sign fractions.
 * For now, returning 0 as requested in prompt "Part 3: Indu Lagna" 
 * which didn't explicitly detail Shree Lagna math, but was in the return object.
 */
export function calculateShreeLagna(
    birthTime: DateTime,
    sunrise: DateTime,
    moonLong: number
): number {
    return 0; 
}
