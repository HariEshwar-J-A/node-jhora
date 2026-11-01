// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Canonical numeric body ids for grahas and lunar nodes.
 *
 * These match {@link EphemerisEngine.getPlanets} `PlanetPosition.id` and all
 * public API JSON (`planetId`, chart planets, harness output).
 *
 * Ashtakavarga bindu tables also use `99` as the ascendant donor key — the same
 * integer as {@link Body.Ketu}; callers distinguish them by context (donor loop
 * vs ephemeris planet list).
 */
export enum Body {
    Sun = 0,
    Moon = 1,
    Mercury = 2,
    Venus = 3,
    Mars = 4,
    Jupiter = 5,
    Saturn = 6,
    /** Optional outer grahas (not included unless requested). */
    Uranus = 11,
    Neptune = 12,
    Pluto = 13,
    Rahu = 10,
    Ketu = 99,
}

/** Donor reference id for the ascendant in Ashtakavarga rules (integer 99). */
export const BODY_ASHTAKAVARGA_LAGNA_DONOR = Body.Ketu;

/** Seven classical grahas in JHora / BPHS display order (Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn). */
export const SEVEN_GRAHAS_JHORA_ORDER: readonly Body[] = [
    Body.Sun,
    Body.Moon,
    Body.Mars,
    Body.Mercury,
    Body.Jupiter,
    Body.Venus,
    Body.Saturn,
];

/** All bodies returned by the ephemeris by default (nine points). */
export const EPHEMERIS_BODIES: readonly Body[] = [
    Body.Sun,
    Body.Moon,
    Body.Mercury,
    Body.Venus,
    Body.Mars,
    Body.Jupiter,
    Body.Saturn,
    Body.Rahu,
    Body.Ketu,
];

/** Trans-Saturnian bodies available when explicitly requested. */
export const OUTER_PLANET_BODIES: readonly Body[] = [Body.Uranus, Body.Neptune, Body.Pluto];
