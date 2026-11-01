// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

import { DateTime } from 'luxon';

import { normalize360 } from '../core/math.js';
import { EphemerisEngine, HouseData, type PrecisionOptions } from '../engine/ephemeris.js';
import type { HouseSystemLegacy } from '../engine/house-registry.js';
import { houseLetterForId, houseSystemIdFromLegacy } from '../engine/house-registry.js';
import type { HouseAnchorId, HouseSystemId } from '../settings/schema.js';
import { houseMethodFromSettings } from '../validation/input.js';

export type HouseSystemMethod = HouseSystemLegacy;

export interface HouseResult {
    system: HouseSystemMethod;
    cusps: number[];
    ascendant: number;
    mc: number;
    vertex?: number;
    armc: number;
    equAsc?: number;
    coAscKoch?: number;
    coAscMunkasey?: number;
    polAsc?: number;
    gauquelinSectors?: number[];
    houseFallback?: HouseData['houseFallback'];
}

export interface HouseCalculationContext {
    houseSystemId?: HouseSystemId;
    houseAnchor?: HouseAnchorId;
    cuspsInMiddle?: boolean;
}

export function calculateHouseCusps(
    date: DateTime,
    lat: number,
    lon: number,
    method: HouseSystemMethod = 'WholeSign',
    engineInstance?: EphemerisEngine,
    ayanamsaMode?: number,
    ayanamsaOffset = 0,
    precision?: PrecisionOptions & HouseCalculationContext,
): HouseResult {
    const engine = engineInstance || EphemerisEngine.getInstance();

    const jd =
        precision?.julianDayUt ??
        engine.julday(date, {
            calendar: precision?.calendar,
            latitude: lat,
            longitude: lon,
        });

    const houseSystemId = precision?.houseSystemId ?? houseSystemIdFromLegacy(method);
    const letter = houseMethodFromSettings(method, houseSystemId);

    const seHouses = engine.getHouses(
        jd,
        lat,
        lon,
        letter,
        true,
        ayanamsaMode,
        ayanamsaOffset,
        undefined,
        {
            ...precision,
            houseSystemId,
        },
    );

    let cusps = seHouses.cusps;
    if (houseSystemId === 'whole_sign') {
        const signStart = Math.floor(seHouses.ascendant / 30) * 30;
        cusps = Array.from({ length: 12 }, (_, i) => (signStart + i * 30) % 360);
    }

    return {
        system: method,
        cusps,
        ascendant: seHouses.ascendant,
        mc: seHouses.mc,
        vertex: seHouses.vertex,
        armc: seHouses.armc,
        equAsc: seHouses.equAsc,
        coAscKoch: seHouses.coAscKoch,
        coAscMunkasey: seHouses.coAscMunkasey,
        polAsc: seHouses.polAsc,
        gauquelinSectors: seHouses.gauquelinSectors,
        houseFallback: seHouses.houseFallback,
    };
}

/** @deprecated Use {@link houseLetterForId} from the house registry. */
export function houseLetterFromSystemId(id: HouseSystemId): string {
    return houseLetterForId(id);
}

/**
 * Calculates Bhava Madhya (Middle of House) and Sandhi (Junction/Start/End).
 */
export function calculateBhavaSandhi(
    cusps: number[],
): { start: number; middle: number; end: number }[] {
    const res = [];
    for (let i = 0; i < 12; i++) {
        const start = cusps[i];
        const next = cusps[(i + 1) % 12];

        let diff = normalize360(next - start);
        if (Math.abs(diff) < 1e-9) diff = 360;

        const middle = normalize360(start + diff / 2);
        const end = next;

        res.push({ start, middle, end });
    }
    return res;
}
