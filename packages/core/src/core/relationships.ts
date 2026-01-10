import { normalize360, getShortestDistance } from './math.js';

export enum Relationship {
    GreatFriend = 'GreatFriend',
    Friend = 'Friend',
    Neutral = 'Neutral',
    Enemy = 'Enemy',
    GreatEnemy = 'GreatEnemy'
}

// Swisseph IDs
const SUN = 0;
const MOON = 1;
const MERCURY = 2;
const VENUS = 3;
const MARS = 4;
const JUPITER = 5;
const SATURN = 6;
const RAHU = 11; // Often not used in Shadbala, but good to have ID

export const PLANET_IDS = [SUN, MOON, MARS, MERCURY, JUPITER, VENUS, SATURN];

interface NaisargikaTable {
    [key: number]: {
        friends: number[];
        neutrals: number[];
        enemies: number[];
    }
}

// Standard BPHS Natural Relationships
export const NAISARGIKA_MAITRI: NaisargikaTable = {
    [SUN]: {
        friends: [MOON, MARS, JUPITER],
        neutrals: [MERCURY],
        enemies: [VENUS, SATURN]
    },
    [MOON]: {
        friends: [SUN, MERCURY],
        neutrals: [MARS, JUPITER, VENUS, SATURN],
        enemies: [] // No enemies among 7 planets
    },
    [MARS]: {
        friends: [SUN, MOON, JUPITER],
        neutrals: [VENUS, SATURN],
        enemies: [MERCURY]
    },
    [MERCURY]: {
        friends: [SUN, VENUS],
        neutrals: [MARS, JUPITER, SATURN],
        enemies: [MOON]
    },
    [JUPITER]: {
        friends: [SUN, MOON, MARS],
        neutrals: [SATURN],
        enemies: [MERCURY, VENUS]
    },
    [VENUS]: {
        friends: [MERCURY, SATURN],
        neutrals: [MARS, JUPITER],
        enemies: [SUN, MOON]
    },
    [SATURN]: {
        friends: [MERCURY, VENUS],
        neutrals: [JUPITER],
        enemies: [SUN, MOON, MARS]
    }
};

/**
 * Calculates Tatkalika Maitri (Temporary Relationship).
 * Based on position in the chart.
 * Friend: Places 2, 3, 4, 10, 11, 12 from Planet A.
 * Enemy: Places 1, 5, 6, 7, 8, 9 from Planet A.
 * 
 * @param posA - Sign number of Planet A (1-12)
 * @param posB - Sign number of Planet B (1-12)
 * @returns 'Friend' | 'Enemy'
 */
export function getTatkalikaMaitri(posA: number, posB: number): 'Friend' | 'Enemy' {
    // Distance from A to B (counting A as 1)
    // Example: A=1 (Aries), B=2 (Taurus). Diff = 1. Count = 2.
    // Logic: (B - A + 12) % 12 + 1 ?
    // If A=1, B=2. (2-1+12)%12 = 1. +1 = 2nd house.
    // If A=1, B=1. (1-1+12)%12 = 0. +1 = 1st house.

    let houseDiff = (posB - posA + 12) % 12 + 1;

    // Friends: 2, 3, 4, 10, 11, 12
    if ([2, 3, 4, 10, 11, 12].includes(houseDiff)) {
        return 'Friend';
    } else {
        return 'Enemy';
    }
}

/**
 * Calculates Panchadha Maitri (Compound Relationship).
 * Sum of Natural and Temporary.
 */
export function getPanchadhaMaitri(natural: 'Friend' | 'Neutral' | 'Enemy', temporary: 'Friend' | 'Enemy'): Relationship {
    if (natural === 'Friend') {
        return temporary === 'Friend' ? Relationship.GreatFriend : Relationship.Neutral;
    } else if (natural === 'Neutral') {
        return temporary === 'Friend' ? Relationship.Friend : Relationship.Enemy;
    } else { // Enemy
        return temporary === 'Friend' ? Relationship.Neutral : Relationship.GreatEnemy;
    }
}

/**
 * Helper to get the full relationship between two planets given their positions.
 */
export function getRelationship(planetA: number, posA: number, planetB: number, posB: number): Relationship {
    // 1. Natural
    const table = NAISARGIKA_MAITRI[planetA];
    let natural: 'Friend' | 'Neutral' | 'Enemy' = 'Neutral';
    if (table.friends.includes(planetB)) natural = 'Friend';
    if (table.enemies.includes(planetB)) natural = 'Enemy';

    // 2. Temporary
    const temporary = getTatkalikaMaitri(posA, posB);

    // 3. Compound
    return getPanchadhaMaitri(natural, temporary);
}
