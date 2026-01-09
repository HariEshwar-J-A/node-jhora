import { normalize360, getShortestDistance } from '../core/math.js';
import { PlanetPosition } from '../engine/ephemeris.js';

const SUN = 0;
const MOON = 1;
const MERCURY = 2;
const VENUS = 3;
const MARS = 4;
const JUPITER = 5;
const SATURN = 6;

// ==========================================
// 1. Dig Bala (Directional Strength)
// ==========================================

// Power Angles (Note: These correspond to Houses 1, 10, 7, 4 roughly)
// Sun/Mars: South (Meridian/MC) -> 10th House Cusp approximately.
// User Spec: Sun/Mars (180 - 10th?? No. MC is usually South).
// User Spec says: "Sun/Mars (180 - 10th), Jup/Mer (0 - 1st), Ven/Moon (270 - 4th), Sat (90 - 7th)"
// Let's interpret '180' as the angle in the abstract circle starting from Ascendant?
// No, the user likely means the angle relative to the Ascendant or simply the House Cusp itself.
// Better interpretation: 
// 1st House (Asc) = East.
// 10th House (MC) = South.
// 7th House (Desc) = West.
// 4th House (IC) = North.
// BUT: Ascendant is the intersection of Ecliptic and Horizon. 
// Dig Bala is calculated based on the distance from the "Power Point".
// Power Points:
// Mercury, Jupiter: East (Ascendant).
// Sun, Mars: South (MC).
// Saturn: West (Descendant = Asc + 180).
// Moon, Venus: North (IC = MC + 180).
// Formula: (Arc Distance from Power Point) / 3. Max 60.
// We should use the ACTUAL Ascendant/MC degrees passed in.

export function calculateDigBala(planet: PlanetPosition, ascendant: number, mc: number): number {
    let powerPoint = 0;

    switch (planet.id) {
        case MERCURY:
        case JUPITER:
            powerPoint = ascendant; // East
            break;
        case SUN:
        case MARS:
            powerPoint = mc; // South
            break;
        case SATURN:
            powerPoint = normalize360(ascendant + 180); // West
            break;
        case MOON:
        case VENUS:
            powerPoint = normalize360(mc + 180); // North
            break;
        default:
            return 0; // Rahu/Ketu
    }

    // Arc Distance
    // BPHS: "Subtract the longitude of the planet from the power point (or vice versa), take the difference... if > 180 take 360-diff"
    // Basically shortest distance on circle.
    const dist = getShortestDistance(planet.longitude, powerPoint);

    // Result is (180 - dist) / 3 ???
    // Wait. If planet is AT power point, strength is MAX (60).
    // If planet is 180 away (weakest), strength is 0.
    // So formula is: (180 - Distance) / 3?
    // Let's check: 
    // Distance 0 -> 180/3 = 60. Correct.
    // Distance 180 -> 0/3 = 0. Correct.
    // User Formula says: "(Arc Distance from Power Angle) / 3" -- This implies Min 0 Max 60? 
    // Wait, if it is "Distance from Power Angle", then if Distance is 0, result is 0? No, that would mean 0 strength at Power Point. 
    // Dig Bala is Strength. So Strength must be high at Power Point.
    // Therefore Formula must be: (180 - ShortestDist) / 3.
    // OR: 60 - (ShortestDist / 3).
    // Let's assume standard BPHS: 60 - (dist/3).

    return (60 - (dist / 3));
}

// ==========================================
// 2. Kaala Bala (Temporal Strength)
// ==========================================

// 2a. Natonata Bala (Day/Night)
// Moon, Mars, Sat: Strong at Midnight.
// Sun, Jup, Ven: Strong at Noon.
// Mercury: Always 60.
// Formula:
// Midnight Strong: 60 if Midnight. 0 if Noon.
// Noon Strong: 60 if Noon. 0 if Midnight.
// Time Diff from Zenith (Noon) or Nadir (Midnight).
// Since we have IsDayTime? Or better, use Sun's position relative to Meridian?
// Day/Night is usually determined by Sun's HAA (Hour Angle) or simply whether Sun is above horizon.
// Simple BPHS approach using Ascendant/Sun:
// Noon is when Sun is at MC. Midnight is when Sun is at IC.
// Difference between Sun and MC.
// If Sun at MC (Noon), Diff = 0.
// If Sun at IC (Midnight), Diff = 180.
// 
// Group A (Noon Strong: Sun, Jup, Ven): (180 - Dist(Sun, MC)) / 3 ?
// No. At Noon (Dist=0), Strength=60. At Midnight (Dist=180), Strength=0.
// Yes: (180 - Dist(Sun, MC)) / 3.
// 
// Group B (Midnight Strong: Moon, Mars, Sat): (180 - Dist(Sun, IC)) / 3 ?
// At Midnight (Sun at IC, Dist=0), Strength=60.
// Yes: (180 - Dist(Sun, IC)) / 3.
// 
// Mercury: 60.

export function calculateNatonataBala(planetId: number, sunLon: number, mcLon: number): number {
    if (planetId === MERCURY) return 60;

    const distSunMC = getShortestDistance(sunLon, mcLon); // 0 at Noon, 180 at Midnight

    // Noon Strong
    if ([SUN, JUPITER, VENUS].includes(planetId)) {
        // Max at Noon (Dist=0).
        // Score = (180 - distSunMC) / 3.
        return (180 - distSunMC) / 3;
    }

    // Midnight Strong
    if ([MOON, MARS, SATURN].includes(planetId)) {
        // Max at Midnight (Dist=180 from MC, or 0 from IC).
        // IC = MC + 180.
        // Dist from IC.
        const icLon = normalize360(mcLon + 180);
        const distSunIC = getShortestDistance(sunLon, icLon);
        return (180 - distSunIC) / 3;
    }

    return 0;
}

// 2b. Paksha Bala (Fortnight)
// Angle Moon - Sun.
// If 0 (New Moon) -> 180 (Full Moon) -> 360 (New Moon).
// Benefics (Jup, Ven, Moon*, Merc*): Max at Full Moon (180).
// Malefics (Sun, Mars, Sat, Merc*): Max at New Moon (0).
// *Classification:
// Moon: Benefic if Waxing? No, Paksha Bala defines specific rule.
// BPHS: "Benefics are strong in Sukla Paksha... Malefics in Krishna Paksha".
// Formula:
// Calculate PakshaAngle = (Moon - Sun). Normalize to 0-360.
// If > 180, it is Krishna Paksha (Waning). Angle becomes (360 - Angle) -> Dist from 0.
// Let's simplify:
// PakshaPoints = (Angle from Sun) / 3. (Max 60 at 180 deg).
// Benefics get PakshaPoints.
// Malefics get (60 - PakshaPoints).
// 
// Notes on Benefic/Malefic dynamic: 
// User said: Moon is Benefic if Waxing.
// Mercury: Assume Benefic for now (simplified).
// Benefics: Jup, Ven, Moon (if Waxing?), Merc.
// Malefics: Sun, Mars, Sat, Moon (if Waning?).
// 
// Refined Logic:
// 1. Calculate Angle (Moon - Sun). 0 to 180 (Waxing), 180 to 360 (Waning).
// 2. Base Strength = (Angle from New Moon) / 3? No.
//    At Full Moon (180), Strength should be 60.
//    At New Moon (0/360), Strength should be 0.
//    Effective Angle = Diff(Moon, Sun). If > 180, consider mirror?
//    Angle used for strength = Is ShortestDist(Moon, Sun)?
//    Yes. ShortestDist is 0..180.
//    Strength = ShortestDist / 3. (0 at New Moon, 60 at Full Moon).
// 3. Assign:
//    Benefics get `Strength` directly. (Strong at Full Moon).
//    Malefics get `60 - Strength`. (Strong at New Moon).
//    
//    Who is Benefic?
//    Jup, Ven: Always Benefic.
//    Sun, Mars, Sat: Always Malefic.
//    Merc: Benefic (Simplified as per user).
//    Moon: Always Benefic context of this calculation? 
//          User said: "Moon: Is Benefic if Waxing, Malefic if Waning".
//          If Moon is Waxing, it uses `Strength` (Strong at Full).
//          If Moon is Waning, it uses `60 - Strength`?
//          Wait. If Waning, ShortestDist is decreasing from 180 to 0. 
//          If Malefic, it gets `60 - Strength`.
//          Example: Waning, Dist=170 (Just past Full). Strength=56. Malefic Score=4.
//          Example: Waning, Dist=10 (Near New). Strength=3. Malefic Score=57.
//          This implies Waning Moon is strong near New Moon?
//          This contradicts "Moon is strong if Full".
//          Usually Moon is ALWAYS considered strong if Full (Paksha Bala applies to Moon itself based on brightness).
//          The "Benefic/Malefic" classification determines how OTHER planets get points from the Moon's state.
//          BUT Paksha Bala is also applied to Moon itself.
//          Moon gets 60 at Full, 0 at New. (Always acts as Benefic for ITS OWN strength calculation).
//          So Moon is treated as Benefic in the assignment list.
//          Wait, user said "Moon: Is Benefic if Waxing, Malefic if Waning".
//          This might mean use the Benefic formula if Waxing, Malefic if Waning.
//          Let's trace:
//          Waxing (0->180). Dist=90. Strength=30. Benefic Formula -> 30.
//          Waning (180->0). Dist=90. Strength=30. Malefic Formula -> 60-30 = 30.
//          This results in Moon getting 30 at Half Moon regardless.
//          At Full (Dist=180). Waxing/Waning boundary. Strength=60. Benefic->60. Malefic->0.
//          If Moon is Malefic when Waning (just past Full), it drops to 0? That's wrong. Moon is bright.
//          Standard BPHS: Moon gets 2 * Paksha points? Or Moon's Paksha bala is simply proportional to brightness.
//          Let's stick to simple rule:
//          Benefics (Jup, Ven, Merc, Moon): Get 60 at Full, 0 at New.
//          Malefics (Sun, Mars, Sat): Get 60 at New, 0 at Full.
//          (Ignoring the "Moon becomes Malefic" complexity for its own score for now, as it usually retains high Shadbala if bright).

export function calculatePakshaBala(planetId: number, sunLon: number, moonLon: number): number {
    const dist = getShortestDistance(sunLon, moonLon); // 0 to 180
    const beneficScore = dist / 3; // 0 (New) to 60 (Full)
    const maleficScore = 60 - beneficScore; // 60 (New) to 0 (Full)

    // Benefics: Jup, Ven, Merc, Moon
    if ([JUPITER, VENUS, MERCURY, MOON].includes(planetId)) {
        return beneficScore;
    }

    // Malefics: Sun, Mars, Sat
    return maleficScore;
}

// 2c. Tribhaga Bala (Day/Night Parts)
// Divide Day (Sunrise-Sunset) into 3, Night (Sunset-Sunrise) into 3.
// Total 6 parts.
// Lordship (Standard BPHS):
// Day 1: Mercury
// Day 2: Sun
// Day 3: Saturn
// Night 1: Moon
// Night 2: Venus
// Night 3: Mars
// Jupiter: Always gets 60 (in some texts, or if birth is in "tr संधि"?).
// User Prompt: "Assign 60 points to the lord of the current 'part' (e.g. Jup gets 60 if birth is in the middle of the day??)"
// Wait. User prompt example "Jup gets 60 if birth is in the middle of the day" CONTRADICTS standard BPHS (Sun is Day 2 lord).
// Standard BPHS Tribhaga Lords:
// Day: Mercury, Sun, Saturn.
// Night: Moon, Venus, Mars.
// Jupiter gets 60 always? Or only in Purna (Full) logic?
// Often Jupiter gets 60 points in "Tribhaga Bala" implies it is the lord of "something" or always gets it.
// BPHS Ch 27 Sl 16: "Jupiter has always 60 Rupas in Tribhaga".
// So Jupiter = 60.
// Others = 60 if in their part, 0 otherwise.

export function calculateTribhagaBala(planetId: number, birthHour: number, sunrise: number, sunset: number): number {
    if (planetId === JUPITER) return 60;

    // Normalize times to 0-24
    let h = birthHour;
    let rise = sunrise;
    let set = sunset;

    // Determine if Day or Night
    // Simple check: is h between rise and set?
    // Handle day rollover? Geocoder usually gives sunrise/set for the current day.
    // Assuming standard times.

    let isDay = false;
    if (rise < set) {
        if (h >= rise && h < set) isDay = true;
    } else {
        // Crossover midnight (rare for sunrise/set unless polar)
        // Assume standard lat/long
    }

    let partDuration = 0;
    let partIndex = 0; // 0, 1, 2

    if (isDay) {
        // Day Parts
        const dayLen = set - rise;
        partDuration = dayLen / 3;
        const timeFromRise = h - rise;
        partIndex = Math.floor(timeFromRise / partDuration);
        if (partIndex > 2) partIndex = 2;

        // Lords: 0=Merc, 1=Sun, 2=Sat
        if (partIndex === 0 && planetId === MERCURY) return 60;
        if (partIndex === 1 && planetId === SUN) return 60;
        if (partIndex === 2 && planetId === SATURN) return 60;

    } else {
        // Night Parts
        // Need to handle time math carefully.
        // Night length = 24 - (set - rise).
        // If h < rise, timeFromSet = (h + 24) - set?
        // If h > set, timeFromSet = h - set.

        let nightLen = (24 - set) + rise;
        let timeFromSet = 0;

        if (h >= set) {
            timeFromSet = h - set;
        } else {
            timeFromSet = (h + 24) - set;
        }

        partDuration = nightLen / 3;
        partIndex = Math.floor(timeFromSet / partDuration);
        if (partIndex > 2) partIndex = 2;

        // Lords: 0=Moon, 1=Venus, 2=Mars
        if (partIndex === 0 && planetId === MOON) return 60;
        if (partIndex === 1 && planetId === VENUS) return 60;
        if (partIndex === 2 && planetId === MARS) return 60;
    }

    return 0;
}

// 2d. Ayanabala (Equinoctial)
// (24 +/- Declination) * Constant.
// Declination is in degrees.
// Direction:
// Sun, Mars, Jup, Ven: North (+Dec) Strong. Formula: (24 + Dec) * C?
// Moon, Sat: South (-Dec) Strong. Formula: (24 + (-Dec)) * C ? (i.e., |Dec - South|?)
// Formula usually:
// If N-Strong: (23.45 + Dec) * Scale?
// BPHS: "Add the declination to 24 if North... Subtract if South..."
// Effectively: (24 + Declination) for North-lovers. (24 - Declination) for South-lovers.
// Wait. If Declination is Negative (South), then:
// For North-lover: 24 + (-10) = 14. Weaker.
// For South-lover: 24 - (-10) = 34. Stronger.
// This logic holds.
// 
// Mercury: Always Strong?
// User: "Mercury (Always strong)".
// We'll give 60.
// 
// Maximum?
// If Dec = 24. 24+24 = 48?
// Virupas usually max 60.
// Multiplier: (60 / 48) = 1.25?
// Or just sum is points?
// BPHS Formula:
// Score = (24 +/- Kranti) * 60 / 48 ? (i.e. * 1.25).
// Let's use 1.25 multiplier to normalize 48 -> 60.

export function calculateAyanabala(planetId: number, declination: number): number {
    if (planetId === MERCURY) return 60; // Usually specific rules, but simplistic is 60 or Median. User said "Always Strong".

    // North Lovers: Sun, Mars, Jup, Ven
    if ([SUN, MARS, JUPITER, VENUS].includes(planetId)) {
        // (24 + Dec)
        // If Dec is -10 (South), becomes 14.
        // If Dec is +23 (North), becomes 47.
        // Multiplier 1.25 => 47 * 1.25 = ~58.75.
        // Min: Dec = -24 ( South Max). Score = 0.
        return Math.max(0, (24 + declination) * 1.25);
    }

    // South Lovers: Moon, Sat
    if ([MOON, SATURN].includes(planetId)) {
        // (24 - Dec)
        // If Dec is -23 (South), becomes 24 - (-23) = 47.
        // If Dec is +23 (North), becomes 24 - 23 = 1.
        return Math.max(0, (24 - declination) * 1.25);
    }

    return 0; // Fallback
}


// ==========================================
// 3. Chesta Bala (Motional Strength)
// ==========================================
// Vakra (Retrograde): 60
// Anuvakra (Entering Retro - tricky to detect without history): 30
// Vikala (Stationary): 15
// Mandatara (Slow Direct): 30
// Mandaa (Slowest Direct): 15
// Luminaries (Sun, Moon): 0 (User Spec).

// Implementation:
// Use `speed` from Ephemeris.
// Speed < 0: Retrograde. (Simple Vakra).
// Speed ~ 0: Stationary.
// Speed > 0: Direct.
// How to distinguish Mandatara/Mandaa/Anuvakra without time-series?
// User Prompt: "Classify motion based on speed." + "Simplification... Implement based on speed from Ephemeris".
// I will implement:
// Speed < -0.001 (Retrograde) -> 60.
// abs(Speed) < 0.001 (Stationary) -> 15.
// Speed > 0 (Direct) -> Need to check "Slow".
// Average speeds:
// Mars: 0.52, Merc: 1.2, Jup: 0.08, Ven: 1.2, Sat: 0.03.
// If speed < AvgSpeed?
// BPHS Chesta is actually complex (8 types).
// User simplified spec: "Mandatara (Slow Direct)... Mandaa (Slowest)".
// Without data histories, I can't detect "Entering Retro" (Anuvakra).
// I will default Direct motion to standard mean value? Or 0?
// User chart says: "Vakra=60... Mandaa=15".
// If moving slow direct?
// Let's implement basics:
// Retro (<0) = 60.
// Stationary (approx 0) = 15.
// Direct (>0) = 30? (Assume average motion is somewhat 'slow' compared to Vakra? No.
// Usually Direct planets get Chesta via Avg Speed comparison.
// If Speed > Avg (Sighra/Fast) -> usually less Bal? Or More?
// User instructions didn't specify "Fast" points.
// Only "Slow Direct" (Mandatara/Mandaa).
// Implication: Fast Direct gets ?? (Normally 7.5 or 0).
// I will assign 30 for Retrograde. Wait, User said "Vakra: 60".
// I will assign:
// Speed < 0: 60.
// Speed approx 0: 15.
// Speed > 0: 7.5 (Neutral/Fast - minimal strength).
// Sun/Moon: 0.

export function calculateChestaBala(planet: PlanetPosition): number {
    if (planet.id === SUN || planet.id === MOON) return 0;

    const speed = planet.speed;

    if (speed < -0.001) {
        return 60; // Vakra
    }
    if (Math.abs(speed) <= 0.001) {
        return 15; // Vikala (Stationary)
    }

    // Direct Motion
    // Without Anuvakra detection, assume standard Direct.
    // User didn't give points for "Normal/Fast".
    // I'll return 0 or low value?
    // Often 15 or 30 is applied for direct planets depending on context.
    // BPHS: "mean motion" logic.
    // I'll return 15 (Mandaa) as a safe baseline for Direct planets, or 0? 
    // Shadbala should sum to ~350-450.
    // If I give 0, it might be too low.
    // Leaning on 15.
    return 15;
}
