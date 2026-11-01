// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

import { Body, SEVEN_GRAHAS_JHORA_ORDER } from './body.js';
import { getShortestDistance, normalize360 } from './math.js';

export enum Relationship {
    GreatFriend = 'GreatFriend',
    Friend = 'Friend',
    Neutral = 'Neutral',
    Enemy = 'Enemy',
    GreatEnemy = 'GreatEnemy',
}

export const PLANET_IDS: readonly Body[] = [...SEVEN_GRAHAS_JHORA_ORDER];

interface NaisargikaTable {
    [key: number]: {
        friends: number[];
        neutrals: number[];
        enemies: number[];
    };
}

// Standard BPHS Natural Relationships
export const NAISARGIKA_MAITRI: NaisargikaTable = {
    [Body.Sun]: {
        friends: [Body.Moon, Body.Mars, Body.Jupiter],
        neutrals: [Body.Mercury],
        enemies: [Body.Venus, Body.Saturn],
    },
    [Body.Moon]: {
        friends: [Body.Sun, Body.Mercury],
        neutrals: [Body.Mars, Body.Jupiter, Body.Venus, Body.Saturn],
        enemies: [], // No enemies among 7 planets
    },
    [Body.Mars]: {
        friends: [Body.Sun, Body.Moon, Body.Jupiter],
        neutrals: [Body.Venus, Body.Saturn],
        enemies: [Body.Mercury],
    },
    [Body.Mercury]: {
        friends: [Body.Sun, Body.Venus],
        neutrals: [Body.Mars, Body.Jupiter, Body.Saturn],
        enemies: [Body.Moon],
    },
    [Body.Jupiter]: {
        friends: [Body.Sun, Body.Moon, Body.Mars],
        neutrals: [Body.Saturn],
        enemies: [Body.Mercury, Body.Venus],
    },
    [Body.Venus]: {
        friends: [Body.Mercury, Body.Saturn],
        neutrals: [Body.Mars, Body.Jupiter],
        enemies: [Body.Sun, Body.Moon],
    },
    [Body.Saturn]: {
        friends: [Body.Mercury, Body.Venus],
        neutrals: [Body.Jupiter],
        enemies: [Body.Sun, Body.Moon, Body.Mars],
    },
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

    const houseDiff = ((posB - posA + 12) % 12) + 1;

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
export function getPanchadhaMaitri(
    natural: 'Friend' | 'Neutral' | 'Enemy',
    temporary: 'Friend' | 'Enemy',
): Relationship {
    if (natural === 'Friend') {
        return temporary === 'Friend' ? Relationship.GreatFriend : Relationship.Neutral;
    } else if (natural === 'Neutral') {
        return temporary === 'Friend' ? Relationship.Friend : Relationship.Enemy;
    } else {
        // Enemy
        return temporary === 'Friend' ? Relationship.Neutral : Relationship.GreatEnemy;
    }
}

/**
 * Helper to get the full relationship between two planets given their positions.
 */
export function getRelationship(
    planetA: number,
    posA: number,
    planetB: number,
    posB: number,
): Relationship {
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
