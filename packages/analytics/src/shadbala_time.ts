import { normalize360, getShortestDistance, PlanetPosition } from '@node-jhora/core';
import { Decimal } from 'decimal.js';

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
// Power Points per BPHS:
//   Mercury, Jupiter → East (Ascendant)
//   Sun, Mars        → South (MC)
//   Saturn           → West (Descendant = Asc + 180)
//   Moon, Venus      → North (IC = MC + 180)
// Formula: 60 - (ShortestArc / 3)
// Max 60 at power point (distance=0), min 0 at opposition (distance=180).

export function calculateDigBala(planet: PlanetPosition, ascendant: number, mc: number): number {
    let powerPoint = 0;

    switch (planet.id) {
        case MERCURY:
        case JUPITER:
            powerPoint = ascendant;
            break;
        case SUN:
        case MARS:
            powerPoint = mc;
            break;
        case SATURN:
            powerPoint = normalize360(ascendant + 180);
            break;
        case MOON:
        case VENUS:
            powerPoint = normalize360(mc + 180);
            break;
        default:
            return 0; // Rahu/Ketu
    }

    const dist = new Decimal(getShortestDistance(planet.longitude, powerPoint));
    return new Decimal(60).minus(dist.div(3)).toNumber();
}

// ==========================================
// 2. Kaala Bala (Temporal Strength)
// ==========================================

// 2a. Natonata Bala (Day/Night)
// Sun, Jupiter, Venus  → strong at Noon (MC). Score = (180 - dist(Sun,MC)) / 3
// Moon, Mars, Saturn   → strong at Midnight (IC). Score = (180 - dist(Sun,IC)) / 3
// Mercury              → always 60.

export function calculateNatonataBala(planetId: number, sunLon: number, mcLon: number): number {
    if (planetId === MERCURY) return 60;

    const D180 = new Decimal(180);
    const D3   = new Decimal(3);
    const distSunMC = new Decimal(getShortestDistance(sunLon, mcLon));

    if ([SUN, JUPITER, VENUS].includes(planetId)) {
        return D180.minus(distSunMC).div(D3).toNumber();
    }

    if ([MOON, MARS, SATURN].includes(planetId)) {
        const icLon = normalize360(mcLon + 180);
        const distSunIC = new Decimal(getShortestDistance(sunLon, icLon));
        return D180.minus(distSunIC).div(D3).toNumber();
    }

    return 0;
}

// 2b. Paksha Bala (Fortnight)
// Benefics (Jupiter, Venus, Mercury, Moon) → strong at Full Moon (ShortestDist(Sun,Moon)=180).
// Malefics (Sun, Mars, Saturn)             → strong at New Moon (distance=0).
// Base = ShortestDist(Sun,Moon) / 3  (0 at New → 60 at Full).
// Benefics get base; Malefics get (60 - base).

export function calculatePakshaBala(planetId: number, sunLon: number, moonLon: number): number {
    const dist         = new Decimal(getShortestDistance(sunLon, moonLon));
    const D3           = new Decimal(3);
    const D60          = new Decimal(60);
    const beneficScore = dist.div(D3);
    const maleficScore = D60.minus(beneficScore);

    if ([JUPITER, VENUS, MERCURY, MOON].includes(planetId)) {
        return beneficScore.toNumber();
    }
    return maleficScore.toNumber();
}

// 2c. Tribhaga Bala (Day/Night Parts)
// Day  (Sunrise → Sunset)  lords: Mercury (1st), Sun (2nd), Saturn (3rd).
// Night (Sunset → Sunrise) lords: Moon (1st), Venus (2nd), Mars (3rd).
// Jupiter always receives 60 (BPHS Ch 27 Sl 16).
// Lords of their part receive 60; all others receive 0.

export function calculateTribhagaBala(planetId: number, birthHour: number, sunrise: number, sunset: number): number {
    if (planetId === JUPITER) return 60;

    const isDay = birthHour >= sunrise && birthHour < sunset;

    if (isDay) {
        const dayLen      = new Decimal(sunset - sunrise);
        const partDuration = dayLen.div(3);
        const timeFromRise = new Decimal(birthHour - sunrise);
        const rawPart      = timeFromRise.div(partDuration).floor().toNumber();
        const partIndex    = Math.min(rawPart, 2);

        if (partIndex === 0 && planetId === MERCURY) return 60;
        if (partIndex === 1 && planetId === SUN)     return 60;
        if (partIndex === 2 && planetId === SATURN)  return 60;
    } else {
        const nightLen     = new Decimal(24 - sunset + sunrise);
        const timeFromSet  = new Decimal(birthHour >= sunset ? birthHour - sunset : birthHour + 24 - sunset);
        const partDuration = nightLen.div(3);
        const rawPart      = timeFromSet.div(partDuration).floor().toNumber();
        const partIndex    = Math.min(rawPart, 2);

        if (partIndex === 0 && planetId === MOON)   return 60;
        if (partIndex === 1 && planetId === VENUS)  return 60;
        if (partIndex === 2 && planetId === MARS)   return 60;
    }

    return 0;
}

// 2d. Ayanabala (Equinoctial Strength)
// North-lovers (Sun, Mars, Jupiter, Venus): Score = (24 + declination) × 1.25. Max ≈ 60.
// South-lovers (Moon, Saturn):              Score = (24 - declination) × 1.25.
// Mercury: always 60 (BPHS).
// Scores clamped to [0, 60].

const D24   = new Decimal(24);
const D1_25 = new Decimal('1.25');
const D60   = new Decimal(60);
const D0    = new Decimal(0);

export function calculateAyanabala(planetId: number, declination: number): number {
    if (planetId === MERCURY) return 60;

    const dec = new Decimal(declination);

    if ([SUN, MARS, JUPITER, VENUS].includes(planetId)) {
        const raw = D24.plus(dec).times(D1_25);
        return Decimal.max(D0, Decimal.min(D60, raw)).toNumber();
    }

    if ([MOON, SATURN].includes(planetId)) {
        const raw = D24.minus(dec).times(D1_25);
        return Decimal.max(D0, Decimal.min(D60, raw)).toNumber();
    }

    return 0;
}

// ==========================================
// 3. Chesta Bala (Motional Strength)
// ==========================================
// Luminaries (Sun, Moon): 0 (they never retrograde).
// Speed < 0   (Vakra / Retrograde): 60
// |Speed| ≤ ε (Vikala / Stationary): 15
// Speed > 0   (Direct):             15 (conservative baseline per BPHS mean-motion logic)

const STATIONARY_EPSILON = new Decimal('0.001');

export function calculateChestaBala(planet: PlanetPosition): number {
    if (planet.id === SUN || planet.id === MOON) return 0;

    const speed = new Decimal(planet.speed);

    if (speed.isNegative() && speed.abs().gt(STATIONARY_EPSILON)) {
        return 60; // Vakra
    }
    if (speed.abs().lte(STATIONARY_EPSILON)) {
        return 15; // Vikala (stationary)
    }
    return 15; // Direct — conservative baseline
}
