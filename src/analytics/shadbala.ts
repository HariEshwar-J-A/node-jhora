import { normalize360, getShortestDistance } from '../core/math.js';
import { getRelationship, Relationship, PLANET_IDS } from '../core/relationships.js';
import { PlanetPosition, HouseData } from '../engine/ephemeris.js';
import {
    calculateDigBala,
    calculateNatonataBala,
    calculatePakshaBala,
    calculateTribhagaBala,
    calculateAyanabala,
    calculateChestaBala
} from './shadbala_time.js';
import { calculateDrigBala } from './aspects.js';

// Exaltation Points (Deep Exaltation Degree)
// Sun: 10 Aries, Moon: 3 Taurus, Mars: 28 Capricorn, Merc: 15 Virgo
// Jup: 5 Cancer, Ven: 27 Pisces, Sat: 20 Libra
const EXALTATION_POINTS: { [key: number]: number } = {
    0: 10,   // Sun (Aries 10)
    1: 33,   // Moon (Taurus 3 => 30+3)
    2: 165,  // Mercury (Virgo 15 => 150+15)
    3: 357,  // Venus (Pisces 27 => 330+27)
    4: 298,  // Mars (Capricorn 28 => 270+28)
    5: 95,   // Jupiter (Cancer 5 => 90+5)
    6: 200   // Saturn (Libra 20 => 180+20)
};

const FEMALE_PLANETS = [1, 3]; // Moon, Venus
const MALE_PLANETS = [0, 2, 4, 5, 6]; // Sun, Mars, Jup, Merc, Sat

// Naisargika Bala (Natural Strength) - virupas
const NAISARGIKA_BALA: { [key: number]: number } = {
    0: 60.00,
    1: 51.43,
    3: 42.85,
    5: 34.28,
    2: 25.71,
    4: 17.14,
    6: 8.57
};

export interface ShadbalaInput {
    planet: PlanetPosition;
    allPlanets: PlanetPosition[]; // Needed for Drig Bala
    houses: HouseData; // for Asc/MC
    sun: PlanetPosition;
    moon: PlanetPosition;
    timeDetails: {
        sunrise: number; // 0-24
        sunset: number; // 0-24
        birthHour: number; // 0-24
    };
    vargaPositions: VargaInfo[];
}

export interface ShadbalaResult {
    total: number;
    sthana: number;
    dig: number;
    kaala: number;
    chesta: number;
    naisargika: number;
    drig: number;
    ishtaPhala: number;
    kashtaPhala: number;
    breakdown: {
        uchcha: number;
        saptavargaja: number;
        kendra: number;
        ojayugma: number;
        dig: number;
        natonata: number;
        paksha: number;
        tribhaga: number;
        ayana: number;
        chesta: number;
        naisargika: number;
        drig: number;
    }
}

/**
 * Calculates Full Shadbala for a single planet.
 */
export function calculateShadbala(input: ShadbalaInput): ShadbalaResult {
    const { planet, allPlanets, houses, sun, moon, timeDetails, vargaPositions } = input;

    // 1. Sthana Bala
    // a. Uchcha
    const uchcha = calculateUchchaBala(planet.id, planet.longitude);

    // b. Saptavargaja
    // Uses planet's Rashi sign for Tatkalika base?
    // We assume vargaPositions[0] is D1?
    // Let's assume input.planet.longitude gives D1 Rashi Sign.
    const planetRashiSign = Math.floor(planet.longitude / 30) + 1;
    const saptavargaja = calculateSaptavargajaBala(planet.id, planetRashiSign, vargaPositions);

    // c. Kendra
    // Need House Number.
    // Calculate House Num: (Sign - AscSign + 1) or using Cusp Longitudes?
    // If we use Whole Sign, House = (Sign - AscSign + 12)%12 + 1.
    // If we use Placidus, we need to check which cusp range it falls in.
    // Let's use Whole Sign logic for simplicity/standard or strictly checking cusps.
    // Given we have houses.cusps, let's find the house index.
    let houseNum = 0;
    // Iterate cusps to find where lon fits.
    // Simple 1-based index finding.
    // Assuming ordered cusps 0..11.
    // This can be complex for overflowing signs (Pisces->Aries).
    // Let's use the HouseData to determine house placement.
    // For now, assume Whole Sign based on Ascendant Degree.
    // Or iterate the cusps.
    // Let's use a helper or simple logic:
    // Check if planet is in House i: Cusp[i] <= P < Cusp[i+1] (handling wrap).
    const ascSign = Math.floor(houses.ascendant / 30) + 1;
    // Whole Sign House Num:
    // (PlanetSign - AscSign + 12) % 12 returns 0 for 1st House, 1 for 2nd... 9 for 10th.
    // We want 1-based House Num.
    houseNum = ((Math.floor(planet.longitude / 30) + 1 - ascSign + 12) % 12) + 1;
    // houseNum is 1..12.
    const kendra = calculateKendraBala(houseNum);

    // d. Ojayugmarasyamsa
    // Need Navamsa Sign.
    // vargaPositions should contain D9.
    const d9 = vargaPositions.find(v => v.vargaName === 'D9' || v.vargaName === 'Navamsa');
    const navamsaSign = d9 ? d9.sign : 0; // Fallback?
    const ojayugma = calculateOjayugmarasyamsaBala(planet.id, planetRashiSign, navamsaSign);

    const sthana = uchcha + saptavargaja + kendra + ojayugma; // + Drekkana? (Phase 5 Part 1 checklist didn't specify Drekkana formula, skipping per user instruction "Sthana... Uchcha, Sapta, Kendra, Oja").

    // 2. Dig Bala
    const dig = calculateDigBala(planet, houses.ascendant, houses.mc);

    // 3. Kaala Bala
    const natonata = calculateNatonataBala(planet.id, sun.longitude, houses.mc);
    const paksha = calculatePakshaBala(planet.id, sun.longitude, moon.longitude);
    const tribhaga = calculateTribhagaBala(planet.id, timeDetails.birthHour, timeDetails.sunrise, timeDetails.sunset);
    const ayana = calculateAyanabala(planet.id, planet.declination); // Requires declination

    // Kaala Total (excluding Yuddha/Ayan? Just sum these 4 is standard Kaala subset).
    // Kaala often includes Varsha/Masa/Dina/Hora (Lord of Year/Month/Day/Hour).
    // User Instructions: "Implement Kaala Bala... Natonata, Paksha, Tribhaga, Ayanabala".
    const kaala = natonata + paksha + tribhaga + ayana;

    // 4. Chesta Bala
    let chesta = calculateChestaBala(planet);

    // 5. Naisargika Bala
    const naisargika = NAISARGIKA_BALA[planet.id] || 0;

    // 6. Drig Bala
    const drig = calculateDrigBala(planet, allPlanets);

    // Total
    const total = sthana + dig + kaala + chesta + naisargika + drig;
    const totalRupas = total / 60; // Usually Shadbala is Virupas, often converted to Rupas for display

    // Ishta / Kashta Phala
    const ishta = Math.sqrt(uchcha * chesta);
    const kashta = Math.sqrt((60 - uchcha) * (60 - chesta));

    return {
        total,
        sthana,
        dig,
        kaala,
        chesta,
        naisargika,
        drig,
        ishtaPhala: ishta,
        kashtaPhala: kashta,
        breakdown: {
            uchcha,
            saptavargaja,
            kendra,
            ojayugma,
            dig,
            natonata,
            paksha,
            tribhaga,
            ayana,
            chesta,
            naisargika,
            drig
        }
    };
}


/**
 * Calculates Uchcha Bala (Exaltation Strength).
 * Formula: (1/3) * (180 - |long - exaltPoint|)
 * If |diff| > 180, use (360 - |diff|).
 */
export function calculateUchchaBala(planetId: number, longitude: number): number {
    const exaltPoint = EXALTATION_POINTS[planetId];
    if (exaltPoint === undefined) return 0; // Rahu/Ketu usually have distinct rules or none here

    let diff = Math.abs(longitude - exaltPoint);
    if (diff > 180) diff = 360 - diff;

    return (1 / 3) * (180 - diff);
}

/**
 * Calculates Kendra Bala (Kendra Strength).
 * Kendra (1, 4, 7, 10): 60
 * Panapara (2, 5, 8, 11): 30
 * Apoklima (3, 6, 9, 12): 15
 * 
 * @param houseNumber - 1-based house number relative to Ascendant
 */
export function calculateKendraBala(houseNumber: number): number {
    if ([1, 4, 7, 10].includes(houseNumber)) return 60;
    if ([2, 5, 8, 11].includes(houseNumber)) return 30;
    return 15;
}

/**
 * Calculates Ojayugmarasyamsa Bala (Odd/Even Sign/Navamsa Strength).
 * Female: 15 in Even Rashi / Even Navamsa.
 * Male: 15 in Odd Rashi / Odd Navamsa.
 */
export function calculateOjayugmarasyamsaBala(planetId: number, rashiSign: number, navamsaSign: number): number {
    let score = 0;
    const isOddRashi = rashiSign % 2 !== 0;
    const isOddNavamsa = navamsaSign % 2 !== 0;

    if (FEMALE_PLANETS.includes(planetId)) {
        // Gain 15 if Even
        if (!isOddRashi) score += 15;
        if (!isOddNavamsa) score += 15;
    } else {
        // Male (incl Merc, Sat per rule). Gain 15 if Odd.
        if (isOddRashi) score += 15;
        if (isOddNavamsa) score += 15;
    }
    return score;
}

/**
 * Calculates Saptavargaja Bala (Strength in 7 Divisional Charts).
 * D1, D2, D3, D7, D9, D12, D30.
 * Uses Compound Relationship (Panchadha Maitri) with the Lord of the Sign occupied.
 * Scores: GF=22.5, F=15, N=11.25, E=7.5, GE=3.75
 * 
 * @param planetId
 * @param vargaData - Array of objects { vargaName: string, sign: number, lordId: number, rashiSignOfLord: number }
 * Note: We need rashiSignOfLord to calculate Tatkalika (Temprary) relationship from the Rashi Chart relative to current Planet's Rashi position?
 * User Prompt: "Calculate the relationship of the planet with the lord of the sign it resides in."
 * Typically, Tatkalika is from Rashi Asc? No, from Planet A to Planet B in Rashi.
 * So we need: Planet A's Rashi Sign and Planet B (Lord)'s Rashi Sign.
 * 
 * @param planetRashiSign - Sign of the planet in D1 (for Tatkalika calculation base)
 * @param vargaLords - Maps vargaName/Id -> { lordId: number, lordRashiSign: number }
 */
export interface VargaInfo {
    vargaName: string;
    sign: number;       // Sign occupied by planet in this varga
    lordId: number;     // Planet ID of the lord of that sign
    lordRashiSign: number; // Rashi sign of that lord (needed for Tatkalika)
}

export function calculateSaptavargajaBala(planetId: number, planetRashiSign: number, vargaPositions: VargaInfo[]): number {
    let totalScore = 0;

    for (const v of vargaPositions) {
        // 1. Own Sign Check?
        // If planet is in its own sign, it is Swakshetra (usually considered Friend or better? BPHS says Own Sign = ? usually Max or counted as Friend/Great Friend?)
        // Standard Saptavargaja rule:
        // Own Sign (Swakshetra): 30 ? Or treated as Adhi Mitra?
        // Some texts say if Swakshetra, treat as Adhi Mitra (22.5) or 30.
        // User prompt says: "Score: Great Friend=22.5, Friend=15, Neutral=11.25, Enemy=7.5, Great Enemy=3.75".
        // It does not specify Swakshetra. Typically Swakshetra is treated same as Adhi Mitra (22.5) or distinct.
        // Many sw scripts use 30 for Swakshetra.
        // However, sticking to prompt "Values: ...".
        // A planet is its own best friend?
        // If planetId == lordId, it is Own Sign.
        // Let's assume Swakshetra = 30 or 22.5? The prompt is explicit about the scale 3.75-22.5.
        // I will use 22.5 for Own Sign if not specified differently, OR calculate relationship which should be GF?
        // A planet's relationship with itself?
        // Naisargika: N/A. Tatkalika: 1st house is Enemy.
        // Logic breaks for self.
        // Convention: Own Sign = 30 or 22.5. I will use 30 (Swakshetra typically > GF). 
        // BUT strict constraint: "Use standard BPHS values".
        // BPHS 7-varga: Swakshetra=30, Adhim=22.5, Mitra=15, Sama=11.25, Satru=7.5, Adhis=3.75.
        // I'll assume Swakshetra is 30.

        let score = 0;
        if (v.lordId === planetId) {
            score = 30;
        } else {
            const rel = getRelationship(planetId, planetRashiSign, v.lordId, v.lordRashiSign);
            switch (rel) {
                case Relationship.GreatFriend: score = 22.5; break;
                case Relationship.Friend: score = 15; break;
                case Relationship.Neutral: score = 11.25; break;
                case Relationship.Enemy: score = 7.5; break;
                case Relationship.GreatEnemy: score = 3.75; break;
            }
        }
        totalScore += score;
    }

    return totalScore;
}
