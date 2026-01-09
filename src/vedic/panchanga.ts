import { normalize360 } from '../core/math.js';
import { DateTime } from 'luxon';
// We might need EphemerisEngine to calculate Sunrise for Vara if we want to be precise,
// but for now, we will assume the input date is relevant or simple day mapping.
// The user prompt says: "Vara: Day of week based on Sunrise (not midnight)".
// This implies we check if the time is before sunrise.
// Since we don't have a sunrise calculator in this module yet (it's usually part of the engine or separate tool),
// and the Phase 2 prompt mentioned "swisseph-wasm" which has `rise_trans` (rise/set), we could use that.
// HOWEVER, to avoid circular dependencies or complexity in this "Business Logic" layer, 
// a common simplified approach in absence of sunrise is: 
// If hour < 6 AM, it's previous day. (Very rough). 
// OR, we assume the user provides the "Vedic Day" index or we use a strict Standard weekday 
// and leave the "Sunrise adjustment" to the caller/consumer.
//
// Let's look at the instruction: "Vara: Day of week based on Sunrise (not midnight)."
// To do this strictly, we need to know the Sunrise time.
// I will add a `sunriseTime` parameter to the Vara calculation or just return the standard weekday index
// with a note that the caller must handle the "before sunrise" logic.
// OR better: Return the standard weekday of the Timestamp, but if we want *Vedic Vara*, 
// we technically need the sunrise.
// Given constraints, I'll implement `calculateVara` receiving a Date and an optional Sunrise time.
// If Sunrise is not passed, it warns or defaults to standard civil day (0-6).

export interface PanchangaResult {
    tithi: { index: number; name: string; percent: number };
    nakshatra: { index: number; name: string; pada: number; percent: number };
    yoga: { index: number; name: string };
    karana: { index: number; name: string };
    vara: { index: number; name: string };
}

const NAKSHATRAS = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra", "Punarvasu", "Pushya", "Ashlesha",
    "Magha", "Purva Phalguni", "Uttara Phalguni", "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
    "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha", "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"
];

const YOGAS = [
    "Vishkumbha", "Priti", "Ayushman", "Saubhagya", "Shobhana", "Atiganda", "Sukarma", "Dhriti", "Shula",
    "Ganda", "Vriddhi", "Dhruva", "Vyaghata", "Harshana", "Vajra", "Siddhi", "Vyatipata", "Variyan",
    "Parigha", "Shiva", "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma", "Indra", "Vaidhriti"
];

const KARANAS = [
    "Bava", "Balava", "Kaulava", "Taitila", "Gara", "Vanija", "Vishti", // Chara (Movable)
    "Shakuni", "Chatushpada", "Naga", "Kimstughna" // Sthira (Fixed)
];

const VARAS = [
    "Ravivara", "Somavara", "Mangalavara", "Budhavara", "Guruvara", "Shukravara", "Shanivara"
];

/**
 * Calculates the Panchanga elements.
 * 
 * @param sunLong - Sun's longitude (0-360).
 * @param moonLong - Moon's longitude (0-360).
 * @param date - Luxon DateTime (for Vara).
 * @param sunriseHour - Optional approximate sunrise hour (decimal, default 6.0). 
 *                     If current hour < sunriseHour, it is the previous Vara.
 * @returns PanchangaResult
 */
export function calculatePanchanga(sunLong: number, moonLong: number, date: DateTime, sunriseHour: number = 6.0): PanchangaResult {
    // 1. Tithi
    // Formula: (Moon - Sun) / 12
    let diff = normalize360(moonLong - sunLong);
    let tithiVal = diff / 12;
    let tithiIndex = Math.floor(tithiVal) + 1; // 1-30
    let tithiPercent = (tithiVal - Math.floor(tithiVal)) * 100;

    // Tithi Name? (Shukla Pratipada to Amavasya)
    // 1-15: Shukla (Waxing), 16-30: Krishna (Waning)
    let tithiNameIndex = tithiIndex;
    let paksha = tithiIndex <= 15 ? "Shukla" : "Krishna";
    let tithiNum = tithiIndex <= 15 ? tithiIndex : tithiIndex - 15;
    let tithiName = `${paksha} ${tithiNum}`;
    // Special names: 15 = Purnima, 30 = Amavasya
    if (tithiIndex === 15) tithiName = "Purnima";
    if (tithiIndex === 30) tithiName = "Amavasya";

    // 2. Nakshatra
    // Formula: Moon / 13.3333
    const NAK_LENGTH = 360 / 27; // 13.3333...
    let nakVal = moonLong / NAK_LENGTH;
    let nakIndex = Math.floor(nakVal); // 0-26
    let nakPercent = (nakVal - nakIndex) * 100;
    let pada = Math.floor(nakPercent / 25) + 1; // 1-4

    // 3. Yoga
    // Formula: (Moon + Sun) / 13.3333
    let sum = normalize360(moonLong + sunLong);
    let yogaVal = sum / NAK_LENGTH;
    let yogaIndex = Math.floor(yogaVal); // 0-26

    // 4. Karana
    // Half-Tithi. Each Tithi has 2 Karanas.
    // Total 60 Karanas in a lunar month (30 Tithis * 2).
    // Logic is complex because of moving/fixed cycle.
    // Karana index (1-60)
    let karanaNum = Math.floor(diff / 6) + 1;

    // Map 1-60 to Name
    let karanaName = "";
    if (karanaNum === 1) karanaName = "Kimstughna";
    else if (karanaNum >= 58) {
        if (karanaNum === 58) karanaName = "Shakuni";
        if (karanaNum === 59) karanaName = "Chatushpada";
        if (karanaNum === 60) karanaName = "Naga";
    } else {
        // Recurring loop of 7 movable Karanas
        // Starting from 2nd half-tithi (index 2)
        // (karanaNum - 2) % 7
        let kIndex = (karanaNum - 2) % 7;
        karanaName = KARANAS[kIndex];
    }

    // 5. Vara
    // Day of week based on Sunrise. 
    // Standard JS/Luxon weekday: 1=Mon, ..., 7=Sun (Luxon) or 0=Sun (JS Date)
    // Luxon: 1=Mon, 7=Sun.
    // Vedic: Sun(0), Mon(1), Tue(2)...
    // Let's map Luxon to Vedic (0=Sun, 1=Mon, ... 6=Sat).
    let civilWeekday = date.weekday; // 1-7 (Mon-Sun)
    // Convert to 0-6 (Sun-Sat)
    // Luxon 7 (Sun) -> 0
    // Luxon 1 (Mon) -> 1
    let vedicWeekday = civilWeekday === 7 ? 0 : civilWeekday;

    // Adjust for sunrise
    let hour = date.hour + date.minute / 60;
    if (hour < sunriseHour) {
        // Previous day
        vedicWeekday = (vedicWeekday - 1 + 7) % 7;
    }

    return {
        tithi: {
            index: tithiIndex,
            name: tithiName,
            percent: tithiPercent
        },
        nakshatra: {
            index: nakIndex + 1, // 1-27
            name: NAKSHATRAS[nakIndex],
            pada: pada,
            percent: nakPercent
        },
        yoga: {
            index: yogaIndex + 1, // 1-27
            name: YOGAS[yogaIndex]
        },
        karana: {
            index: karanaNum,
            name: karanaName
        },
        vara: {
            index: vedicWeekday,
            name: VARAS[vedicWeekday]
        }
    };
}
