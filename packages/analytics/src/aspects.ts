import { normalize360, getShortestDistance, PlanetPosition } from '@node-jhora/core';

const SUN = 0;
const MOON = 1;
const MERCURY = 2;
const VENUS = 3;
const MARS = 4;
const JUPITER = 5;
const SATURN = 6;

// Natural Classification for Aspect Strength
// Benefics add strength, Malefics subtract strength.
// Simplification per user instruction: Jup, Ven, Moon, Merc are Benefics.
const NATURAL_BENEFICS = [JUPITER, VENUS, MOON, MERCURY];
const NATURAL_MALEFICS = [SUN, MARS, SATURN];

/**
 * Calculates the Drishti Value (Aspect Value) of an Aspecting Planet on an Aspected Planet.
 * Range: 0 to 60 Virupas.
 * 
 * @param angle - Angle from Aspecting Planet to Aspected Planet (0-360).
 *                Formula: (Aspected - Aspecting + 360) % 360.
 * @param aspectingPlanetId - ID of the planet casting the aspect (for special rules).
 */
export function calculateDrishtiValue(angle: number, aspectingPlanetId: number): number {
    let drishti = 0;

    // Standard Aspect Formula (BPHS)
    if (angle >= 30 && angle < 60) {
        drishti = (angle - 30) / 2;
    } else if (angle >= 60 && angle < 90) {
        drishti = (angle - 60) + 15;
    } else if (angle >= 90 && angle < 120) {
        drishti = (120 - angle) / 2 + 30; // 45 down to 30? Wait. Formula Check.
        // User Prompt: "90-120: (120 - Angle) / 2 + 30".
        // At 90: (30)/2 + 30 = 45.
        // At 120: 0/2 + 30 = 30.
        // Seems correct curve (Peak at 90?? No, Standard aspect peaks at 180).
        // Standard curve has minor peak at 90 (45) then drops to 30 at 120.
    } else if (angle >= 120 && angle < 150) {
        drishti = 150 - angle; // 30 down to 0 ?
        // User Prompt: "120-150: 150 - Angle".
        // At 120: 30. At 150: 0. Correct.
    } else if (angle >= 150 && angle < 180) {
        drishti = (angle - 150) * 2; // 0 up to 60.
        // At 150: 0. At 180: 60. Correct. Max at 180.
    } else if (angle >= 180 && angle <= 300) {
        drishti = (300 - angle) / 2; // 180->60. 300->0.
        // At 180: 120/2 = 60. At 300: 0. Correct.
    }

    // Special Aspects (Add to Standard)
    // Mars: Add 15 at 90 (4th house) and 210 (8th house).
    // Jupiter: Add 30 at 120 (5th house) and 240 (9th house).
    // Saturn: Add 45 at 60 (3rd house) and 270 (10th house).
    // How to handle "at 90"? The aspect is a curve.
    // Usually the special aspect is added to the computed value for the RANGE.
    // Or is it a separate full curve?
    // User Prompt: "Add 15 virupas at 90... Implement logic to handle the range around these peaks".
    // Standard interpretation (Drishti Pinda):
    // Special aspect adds a fixed value if the angle is within the "orb" or house?
    // STRICT BPHS interpretation implies the formula CHANGES for these planets.
    // BUT User said "Add to Standard".
    // Let's implement a peak distribution?
    // Simpler interpretation found in software:
    // Special Aspects are full (60) at exact points if standard is 0?
    // E.g. Saturn at 60 (3rd). Standard: (60-60)+15 = 15. Special: +45. Total = 60.
    // Saturn at 270 (10th). Standard: (300-270)/2 = 15. Special: +45. Total = 60.
    // This looks like the intention: Special aspects boost the value to 60 at the peak.
    // How to decay?
    // Let's apply a linear decay +/- 30 degrees around the peak?
    // Or simply rely on the user instruction "Add X virupas".
    // I will add the fixed value if the angle is within +/- 15 degrees of the peak?
    // No, standard aspects are continuous functions.
    // The "Standard Formula" covers the whole 360 circle (mostly).
    // Mars 4th (90): Standard gives 45. Add 15 = 60.
    // Mars 8th (210): Standard gives (300-210)/2 = 45. Add 15 = 60.
    // Jupiter 5th (120): Standard gives 30. Add 30 = 60.
    // Jupiter 9th (240): Standard gives (300-240)/2 = 30. Add 30 = 60.
    // Saturn 3rd (60): Standard gives 15. Add 45 = 60.
    // Saturn 10th (270): Standard gives 15. Add 45 = 60.
    // 
    // CONCLUSION: The additives make the special aspects exactly 60 at the peaks.
    // Therefore, I should add the "Boost" if the angle matches?
    // But what about 269 deg?
    // Standard: (300-269)/2 = 15.5.
    // If I add 45, it becomes 60.5 (Over cap). Cap at 60.
    // So the rule is simply: Add the user-specified amount to the standard calculation, Cap at 60.
    // AND: Apply this boost *continuously*?
    // No, usually special aspects are specific Ranges.
    // But notice the standard formula already covers the range.
    // Mars 8th (210) is inside 180-300 range.
    // I will apply the addition everywhere?
    // e.g. Saturn at 180 (7th). Standard 60. Special +45?? No.
    // Saturn has special aspect on 3rd and 10th. Not 7th.
    // So boost applies only "around" 3rd and 10th.
    // However, the prompt says "Saturn: Add 45 virupas at 60... and 270".
    // It doesn't define the width.
    // Given the mathematical perfection of the peak sums (always summing to 60), I will assume the Special Values are added *only* when the standard formula applies to those sectors?
    // Angle 60 is start of 60-90 sector.
    // Angle 270 is inside 180-300.
    // I will add the boost if the angle is "close" to the peak?
    // Actually, widespread implementation: 
    // Special aspect is a separate calculation, take MAX? No, prompt says ADD.
    // I will add the specific value only if Angle is within +/- 15 deg of peak?
    // Or maybe the prompt implies the Addition is constant for the House?
    // Let's look at the math again.
    // Saturn 60: Standard = 15.
    // If we want it to be 60, we add 45.
    // Saturn at 61: Standard = 16. If we add 45 -> 61 (Cap 60).
    // Saturn at 89: Standard = 44. If we add 45 -> 89 (Cap 60).
    // This seems to imply full strength across the house?
    // Let's assume the boosted value is applied *at the peak* and we linearly interpolate? 
    // NO, that's too complex for "Phase 5".
    // 
    // SIMPLIFICATION:
    // I will checking if angle is within +/- 10 degrees of the peak, and add the full value, capping at 60.
    // Mars: Peak 90, 210.
    // Jup: Peak 120, 240.
    // Sat: Peak 60, 270.
    // Better yet: Just apply the addition logic continuously using a bell curve? No.
    // 
    // STRICT INTERPRETATION of "Add 15 virupas at 90":
    // It likely implies the term is simply added.
    // But WHERE?
    // Let's assume specific "Special Aspect Value" is added if the angle falls in the *Sign* roughly?
    // BPHS implies Full Aspect on 4th House.
    // 4th House = 90 deg to 120 deg (Whole Sign) or Peak at 90.
    // 
    // Let's follow the standard "Drishti Pinda" calculation method found in reputable sources (e.g. Raman/JHora logic):
    // Special aspects are added.
    // Mars: Add 15 to angles 30-120?? No.
    // 
    // REVISIT PROMPT: "Implement logic to handle the range around these peaks".
    // User left it to me.
    // Logic: Use a simplified "orb" of +/- 15 degrees (1 sign width total).
    // Within Peak +/- 15 deg, add the bonus.

    let specialBoost = 0;

    if (aspectingPlanetId === MARS) {
        // 90 (4th) +/- 15
        if (Math.abs(angle - 90) <= 15) specialBoost += 15;
        // 210 (8th) +/- 15
        if (Math.abs(angle - 210) <= 15) specialBoost += 15;
    } else if (aspectingPlanetId === JUPITER) {
        // 120 (5th) +/- 15
        if (Math.abs(angle - 120) <= 15) specialBoost += 30;
        // 240 (9th) +/- 15
        if (Math.abs(angle - 240) <= 15) specialBoost += 30;
    } else if (aspectingPlanetId === SATURN) {
        // 60 (3rd) +/- 15
        if (Math.abs(angle - 60) <= 15) specialBoost += 45;
        // 270 (10th) +/- 15
        if (Math.abs(angle - 270) <= 15) specialBoost += 45;
    }

    // Apply boost
    drishti += specialBoost;

    // Cap at 60
    return Math.min(drishti, 60);
}

/**
 * Calculates Drig Bala for a target planet.
 * Sum of 1/4 Drishti from Benefics - 1/4 Drishti from Malefics.
 * 
 * @param targetPlanet - The planet receiving aspects.
 * @param allPlanets - List of all planets (containing positions).
 */
export function calculateDrigBala(targetPlanet: PlanetPosition, allPlanets: PlanetPosition[]): number {
    let score = 0;

    for (const aspectingPlanet of allPlanets) {
        if (aspectingPlanet.id === targetPlanet.id) continue;
        if (aspectingPlanet.id > SATURN) continue; // Ignore Rahu/Ketu for Aspect Strength usually

        // Calculate Angle: (Aspected - Aspecting)
        // Ensure 0-360 positive
        let angle = normalize360(targetPlanet.longitude - aspectingPlanet.longitude);

        const drishtiValue = calculateDrishtiValue(angle, aspectingPlanet.id);

        if (drishtiValue > 0) {
            const quarterDrishti = drishtiValue / 4;

            if (NATURAL_BENEFICS.includes(aspectingPlanet.id)) {
                score += quarterDrishti;
            } else if (NATURAL_MALEFICS.includes(aspectingPlanet.id)) {
                score -= quarterDrishti;
            }
        }
    }

    return score;
}
