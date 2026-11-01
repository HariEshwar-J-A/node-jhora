// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Shared Jaimini rashi-dasa helpers (sign durations, kendradi ordering).
 *
 * @provenance BPHS / Jaimini Sutras via Sanjay Rath (Narayana, Sudasa, Drig);
 *   P.V.R. Narasimha Rao, Jaimini Sutramritam summaries.
 */

import { PlanetPosition } from '@node-jhora/core';

import { JaiminiDashas } from '../jaimini/dashas.js';

/** Mulatrikona rashi (0–11) for graha-year reduction in Moola Dasa. */
export const MOOLATRIKONA_SIGN: Record<string, number> = {
    Sun: 4,
    Moon: 1,
    Mars: 0,
    Mercury: 5,
    Jupiter: 8,
    Venus: 6,
    Saturn: 10,
    Rahu: 10,
    Ketu: 7,
};

export const VIMSHOTTARI_YEARS: Record<string, number> = {
    Sun: 6,
    Moon: 10,
    Mars: 7,
    Mercury: 17,
    Jupiter: 16,
    Saturn: 19,
    Venus: 20,
    Rahu: 18,
    Ketu: 7,
};

/** Exaltation / debilitation rashi (0–11); used for Moola ±1 year riders. */
const EXALT_SIGN: Record<string, number> = {
    Sun: 0,
    Moon: 1,
    Mars: 9,
    Mercury: 5,
    Jupiter: 3,
    Venus: 11,
    Saturn: 6,
    Rahu: 1,
    Ketu: 7,
};

const DEBIL_SIGN: Record<string, number> = {
    Sun: 6,
    Moon: 7,
    Mars: 3,
    Mercury: 11,
    Jupiter: 9,
    Venus: 5,
    Saturn: 0,
    Rahu: 7,
    Ketu: 1,
};

export function planetSignIndex(planet: PlanetPosition): number {
    return Math.floor(planet.longitude / 30);
}

/** Count inclusive from `fromSign` to `toSign` forward on the zodiac. */
export function forwardSignCount(fromSign: number, toSign: number): number {
    let c = toSign - fromSign + 1;
    if (c <= 0) c += 12;
    return c;
}

/**
 * Moola / Lagna-kendradi graha years for one planet (Sanjay Rath, Moola Dasa).
 * Count to mulatrikona minus one, subtract from Vimshottari; ±1 for exalt/debil;
 * zero → full Vimshottari; negative → absolute value.
 */
export function moolaDashaYearsForPlanet(name: string, planet: PlanetPosition): number {
    const vim = VIMSHOTTARI_YEARS[name] ?? 0;
    const occupied = planetSignIndex(planet);
    const mool = MOOLATRIKONA_SIGN[name] ?? occupied;
    let count = forwardSignCount(occupied, mool) - 1;
    if (count < 0) count += 12;
    let reduction = count;
    const ex = EXALT_SIGN[name];
    const deb = DEBIL_SIGN[name];
    if (ex !== undefined && occupied === ex && occupied !== mool) reduction += 1;
    if (deb !== undefined && occupied === deb && occupied !== mool) reduction -= 1;
    let net = vim - reduction;
    if (net === 0) net = vim;
    return Math.abs(net);
}

/** Kendra → panapara → apoklima from anchor (Rath Sudasa / Narayana). */
export function kendradiSignSequence(anchorSign: number, forward: boolean): number[] {
    const offsets = [0, 3, 6, 9, 1, 4, 7, 10, 2, 5, 8, 11];
    if (forward) return offsets.map((o) => (anchorSign + o) % 12);
    return offsets.map((o) => (anchorSign - o + 12) % 12);
}

/** Sudasa direction with Saturn/Ketu exceptions (Sanjay Rath, Sudasa lesson). */
export function sudasaForward(anchorSign: number, planets: PlanetPosition[]): boolean {
    /** Aries(0), Gemini(2), … are odd rashis → forward (IndiaDivine Sudasa lesson). */
    let forward = anchorSign % 2 === 0;
    const saturnIn = planets.some((p) => p.name === 'Saturn' && planetSignIndex(p) === anchorSign);
    const ketuIn = planets.some((p) => p.name === 'Ketu' && planetSignIndex(p) === anchorSign);
    if (saturnIn) forward = true;
    if (ketuIn) forward = !forward;
    return forward;
}

export function narayanaSignYears(signIndex: number, planets: PlanetPosition[]): number {
    return JaiminiDashas.calculateSignDuration(signIndex, planets);
}

/** Drig dasa sequence: trines from 9th, 10th, 11th houses (Parasara engine convention). */
export function drigDashaSignSequence(lagnaSign: number): number[] {
    const bases = [8, 9, 10].map((o) => (lagnaSign + o) % 12);
    const out: number[] = [];
    for (const b of bases) {
        out.push(b, (b + 4) % 12, (b + 8) % 12);
    }
    return out;
}

/** Chara-style years: count from dasa sign to its lord (Prakriti chakra). */
export function drigSignYears(signIndex: number, planets: PlanetPosition[]): number {
    return JaiminiDashas.calculateSignDuration(signIndex, planets);
}

/** Śrī Lagna from natal lagna and Moon's nakshatra fraction (Rath / IndiaDivine). */
export function sriLagnaLongitude(lagnaLongitude: number, moonLongitude: number): number {
    const nakSpan = 360 / 27;
    const lon = ((moonLongitude % 360) + 360) % 360;
    const inNak = lon % nakSpan;
    const fraction = inNak / nakSpan;
    return (lagnaLongitude + fraction * 360) % 360;
}
