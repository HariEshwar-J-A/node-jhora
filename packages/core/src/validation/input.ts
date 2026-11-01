// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

import { DateTime } from 'luxon';

import { AYANAMSA_MODELS } from '../engine/ayanamsa.js';
import type { PrecisionProfile } from '../engine/deltat.js';
import type { PositionMode } from '../engine/ephemeris.js';
import {
    HOUSE_LETTERS,
    houseLetterForId,
    type HouseSystemId,
    houseSystemIdFromLegacy,
    isHouseLetter,
} from '../engine/house-registry.js';
import { NodeJHoraError, NodeJHoraErrorCode } from '../errors.js';
import { PRECISION_PROFILES } from '../settings/schema.js';
import {
    DELTA_T_OVERRIDE_ABS_MAX_SECONDS,
    EPHEMERIS_ASTRO_YEAR_MAX,
    EPHEMERIS_ASTRO_YEAR_MIN,
    EPHEMERIS_JD_UT_MAX,
    EPHEMERIS_JD_UT_MIN,
} from './bounds.js';
const SIDEREAL_FRAMES = new Set(['jhora', 'se-apparent']);
const AYANAMSA_FRAMES = new Set(['geometric', 'apparent']);
const NODE_TYPES = new Set(['mean', 'true']);
const POSITION_MODES = new Set(['geometric', 'apparent']);

export function assertFiniteNumber(
    value: number,
    name: string,
    code: NodeJHoraErrorCode = NodeJHoraErrorCode.INVALID_INPUT,
): number {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new NodeJHoraError(code, `${name} must be a finite number`, { field: name, value });
    }
    return value;
}

export function assertLatitude(lat: number): number {
    const v = assertFiniteNumber(lat, 'latitude');
    if (v < -90 || v > 90) {
        throw new NodeJHoraError(
            NodeJHoraErrorCode.OUT_OF_RANGE,
            `latitude must be between -90 and 90 degrees`,
            { latitude: v },
        );
    }
    return v;
}

/**
 * Normalize geographic longitude to [-180, 180). Values with magnitude at most
 * 360° are accepted (e.g. 360° → 180°, -540° → -180°). Larger magnitudes are
 * invalid input, not silently wrapped.
 */
export function normalizeLongitude(lon: number): number {
    const v = assertFiniteNumber(lon, 'longitude');
    if (Math.abs(v) > 360) {
        throw new NodeJHoraError(
            NodeJHoraErrorCode.INVALID_INPUT,
            'longitude must be within ±360 degrees (use a value in [-360, 360] before normalization)',
            { longitude: v },
        );
    }
    let x = ((((v + 180) % 360) + 360) % 360) - 180;
    if (x === -180 && v > 0) x = 180;
    return x;
}

export function assertJulianDayUt(jd: number): number {
    const v = assertFiniteNumber(jd, 'Julian Day');
    if (v < EPHEMERIS_JD_UT_MIN || v > EPHEMERIS_JD_UT_MAX) {
        throw new NodeJHoraError(
            NodeJHoraErrorCode.OUT_OF_RANGE,
            `Julian Day (UT) ${v} is outside the supported range ` +
                `${EPHEMERIS_ASTRO_YEAR_MIN} to ${EPHEMERIS_ASTRO_YEAR_MAX} ` +
                `(JD ${EPHEMERIS_JD_UT_MIN}–${EPHEMERIS_JD_UT_MAX})`,
            { jd: v },
        );
    }
    return v;
}

function assertIntegerComponent(value: number, field: string): void {
    if (!Number.isInteger(value)) {
        throw new NodeJHoraError(NodeJHoraErrorCode.INVALID_INPUT, `${field} must be an integer`, {
            field,
            value,
        });
    }
}

/**
 * Validate a Luxon {@link DateTime} for {@link EphemerisEngine.getPlanets} and
 * other APIs that require an explicit civil instant in UTC.
 */
export function parseEngineDateTime(input: DateTime): DateTime {
    return assertEngineDateTime(input);
}

/**
 * Validate a Luxon {@link DateTime} or coerce a JS `Date` for {@link EphemerisEngine.julday}.
 */
export function parseEngineDateTimeOrJsDate(input: DateTime | Date): DateTime {
    if (input instanceof Date) {
        const ms = input.getTime();
        if (!Number.isFinite(ms)) {
            throw new NodeJHoraError(
                NodeJHoraErrorCode.INVALID_INPUT,
                'Date must be a valid JavaScript Date',
            );
        }
        const dt = DateTime.fromJSDate(input, { zone: 'utc' });
        if (!dt.isValid) {
            throw new NodeJHoraError(
                NodeJHoraErrorCode.INVALID_INPUT,
                dt.invalidReason ?? 'Invalid Date',
            );
        }
        return assertEngineDateTime(dt);
    }
    return assertEngineDateTime(input);
}

export function assertEngineDateTime(date: DateTime): DateTime {
    if (!date || typeof date !== 'object' || !('isValid' in date)) {
        throw new NodeJHoraError(
            NodeJHoraErrorCode.INVALID_INPUT,
            'date must be a Luxon DateTime in UTC',
        );
    }
    const utc = date.toUTC();
    if (!utc.isValid) {
        throw new NodeJHoraError(
            NodeJHoraErrorCode.INVALID_INPUT,
            utc.invalidReason ?? 'Invalid DateTime',
        );
    }
    const { year, month, day, hour, minute, second, millisecond } = utc;
    assertIntegerComponent(hour, 'hour');
    assertIntegerComponent(minute, 'minute');
    assertIntegerComponent(second, 'second');
    assertIntegerComponent(millisecond, 'millisecond');

    const roundTrip = DateTime.fromObject(
        { year, month, day, hour, minute, second, millisecond },
        { zone: 'utc' },
    );
    if (!roundTrip.isValid) {
        throw new NodeJHoraError(
            NodeJHoraErrorCode.INVALID_INPUT,
            roundTrip.invalidReason ?? 'Invalid calendar date',
            { year, month, day },
        );
    }
    return utc;
}

export function assertAyanamsaMode(mode: number): number {
    const v = assertFiniteNumber(mode, 'ayanamsa mode');
    if (!Number.isInteger(v)) {
        throw new NodeJHoraError(
            NodeJHoraErrorCode.INVALID_INPUT,
            'ayanamsa mode must be an integer',
            { mode: v },
        );
    }
    if (!(v in AYANAMSA_MODELS)) {
        throw new NodeJHoraError(NodeJHoraErrorCode.INVALID_INPUT, `unknown ayanamsa mode ${v}`, {
            mode: v,
        });
    }
    return v;
}

export function assertHouseMethod(method: string): string {
    if (typeof method !== 'string' || !isHouseLetter(method)) {
        throw new NodeJHoraError(
            NodeJHoraErrorCode.INVALID_INPUT,
            `house method must be one of ${[...HOUSE_LETTERS].join(', ')}`,
            { method },
        );
    }
    return method;
}

/** Map legacy {@link HouseSystem} name or settings id to a single-letter house code. */
export function houseMethodFromSettings(
    legacyOrLetter: string,
    houseSystemId?: HouseSystemId,
): string {
    if (isHouseLetter(legacyOrLetter)) return legacyOrLetter;
    if (houseSystemId !== undefined) return houseLetterForId(houseSystemId);
    const id = houseSystemIdFromLegacy(legacyOrLetter as never);
    return houseLetterForId(id);
}

export function assertAyanamsaFrame(frame: string): 'geometric' | 'apparent' {
    if (!AYANAMSA_FRAMES.has(frame)) {
        throw new NodeJHoraError(
            NodeJHoraErrorCode.INVALID_INPUT,
            `ayanamsa frame must be 'geometric' or 'apparent'`,
            { frame },
        );
    }
    return frame as 'geometric' | 'apparent';
}

export function assertSiderealFrame(frame: string): 'jhora' | 'se-apparent' {
    if (!SIDEREAL_FRAMES.has(frame)) {
        throw new NodeJHoraError(
            NodeJHoraErrorCode.INVALID_INPUT,
            `siderealFrame must be 'jhora' or 'se-apparent'`,
            { siderealFrame: frame },
        );
    }
    return frame as 'jhora' | 'se-apparent';
}

export function assertPrecisionProfile(profile: string | undefined): PrecisionProfile | undefined {
    if (profile === undefined) return undefined;
    if (!PRECISION_PROFILES.includes(profile as PrecisionProfile)) {
        throw new NodeJHoraError(
            NodeJHoraErrorCode.INVALID_INPUT,
            `precisionProfile must be 'jhora', 'modern', or 'truth'`,
            { precisionProfile: profile },
        );
    }
    return profile as PrecisionProfile;
}

export function assertNodeType(nodeType: string): 'mean' | 'true' {
    if (!NODE_TYPES.has(nodeType)) {
        throw new NodeJHoraError(
            NodeJHoraErrorCode.INVALID_INPUT,
            `nodeType must be 'mean' or 'true'`,
            { nodeType },
        );
    }
    return nodeType as 'mean' | 'true';
}

export function assertPositionMode(mode: string): PositionMode {
    if (!POSITION_MODES.has(mode)) {
        throw new NodeJHoraError(
            NodeJHoraErrorCode.INVALID_INPUT,
            `positionMode must be 'geometric' or 'apparent'`,
            { positionMode: mode },
        );
    }
    return mode as PositionMode;
}

export function assertDeltaTOverrideSeconds(seconds: number | undefined): number | undefined {
    if (seconds === undefined) return undefined;
    const v = assertFiniteNumber(seconds, 'deltaTOverrideSeconds');
    if (Math.abs(v) > DELTA_T_OVERRIDE_ABS_MAX_SECONDS) {
        throw new NodeJHoraError(
            NodeJHoraErrorCode.OUT_OF_RANGE,
            `deltaTOverrideSeconds must be within ±${DELTA_T_OVERRIDE_ABS_MAX_SECONDS} seconds`,
            { deltaTOverrideSeconds: v },
        );
    }
    return v;
}

export interface GeoLocationInput {
    latitude: number;
    longitude: number;
    altitude?: number;
}

export function assertGeoLocation(
    location: GeoLocationInput | undefined,
    options: { required?: boolean } = {},
): GeoLocationInput | undefined {
    if (location === undefined) {
        if (options.required) {
            throw new NodeJHoraError(
                NodeJHoraErrorCode.INVALID_INPUT,
                'location is required for topocentric calculations',
            );
        }
        return undefined;
    }
    const latitude = assertLatitude(location.latitude);
    const longitude = normalizeLongitude(location.longitude);
    let altitude = location.altitude;
    if (altitude !== undefined) {
        altitude = assertFiniteNumber(altitude, 'altitude');
    }
    return { latitude, longitude, altitude };
}

export function assertNotInitialized(): never {
    throw new NodeJHoraError(
        NodeJHoraErrorCode.NOT_INITIALIZED,
        'EphemerisEngine not initialised — call `await engine.initialize()` first.',
    );
}
