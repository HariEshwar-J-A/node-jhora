// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Rise, set, and upper/lower meridian transit.
 *
 * The instant is the root of the horizon residual in {@link altitudeMinusTarget}
 * or of the hour-angle residual in {@link transitHourAngleResidual}.
 *
 * The hour angle at contact follows the US Naval Observatory Nautical Almanac
 * Office, *Almanac for Computers* (1990) (reproduced e.g. edwilliams.org
 * sunrise/sunset algorithm):
 *
 *   cos H₀ = (sin h₀ − sin φ sin δ) / (cos φ cos δ)
 *
 * with h₀ the geometric altitude of the limb on the horizon (0 for a disc
 * centre on the unrefracted horizon). Upper transit is local apparent
 * sidereal time equal to right ascension; lower transit is twelve sidereal
 * hours from that. A few iterations absorb the body's motion, using the mean
 * sidereal rate 360.985647° per mean solar day (Aoki et al. 1982; ERFA
 * `gmst82`, BSD-3). The estimate
 * is then polished by a local Brent root so a short polar arc is not replaced
 * by a crossing hours away.
 *
 * Which disc is used, and the latitude at which the modern oracle changes
 * disc, is recorded in ADR 0009. Nothing here is copied from another
 * implementation.
 */

import { DateTime } from 'luxon';

import { AU_KM } from '../engine/apparent.js';
import { getGAST, julday, mod360 } from '../engine/coordinates.js';
import { withDeltaTContext } from '../engine/deltat.js';
import {
    DEFAULT_POSITION_MODE,
    EphemerisEngine,
    type GeoLocation,
    type PositionMode,
} from '../engine/ephemeris.js';
import {
    type CalculationSettings,
    type DeltaTForecastId,
    getPreset,
    type PrecisionProfileId,
    type SunriseLimb,
} from '../settings/index.js';
import {
    altitudeMinusTarget,
    riseSetPlaceMode,
    topocentricEquatorialHorizon,
    transitHourAngleResidual,
} from './horizon.js';
import { brent } from './solver.js';

export type RiseSetBodyId = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const RISE_SET_BODY_NAMES: Record<RiseSetBodyId, string> = {
    0: 'Sun',
    1: 'Moon',
    2: 'Mercury',
    3: 'Venus',
    4: 'Mars',
    5: 'Jupiter',
    6: 'Saturn',
};

export type RiseSetEvent = 'rise' | 'set' | 'upper_transit' | 'lower_transit';

export interface RiseSetDefinition {
    /** Which oracle's horizon rule and ΔT context to follow. See ADR 0009. */
    precisionProfile: PrecisionProfileId;
    limb: SunriseLimb;
    refraction: boolean;
    /** Atmospheric pressure, hPa (mbar). */
    pressureHPa: number;
    /** Air temperature, °C. */
    temperatureC: number;
    /** Geometric horizon altitude, degrees (0 = sea-level horizon). */
    horizonAltitudeDeg: number;
    positionMode: PositionMode;
    /**
     * Fixed ΔT in seconds for this search, when the caller pins the clock.
     * Absent means the precision profile's own ΔT model.
     */
    deltaTOverrideSeconds?: number;
    /** Post-bridge forecast when `precisionProfile` is `'modern'`. Default `'published'`. */
    deltaTForecast?: DeltaTForecastId;
}

export type RiseSetOutcome =
    | { kind: 'time'; jdUt: number; dateTime: DateTime }
    | { kind: 'none'; reason: 'polar_day' | 'polar_night' };

const STEP = 1 / 48;
/**
 * Forward look-ahead, in days. Both oracles return a one-off crossing — a
 * polar Sun, a grazing Moon set — only when it falls inside 26.0000 hours of
 * the start. A daily event a little over 24 hours out is still inside that
 * window; the next day's grazing set, past 26 hours, is reported as no event.
 */
const SEARCH_SPAN_DAYS = 26 / 24;
/** Mean sidereal rotation, degrees per mean solar day (Meeus, ch. 12). */
const SIDEREAL_DEG_PER_DAY = 360.985647;
const SIDEREAL_DAY = 360 / SIDEREAL_DEG_PER_DAY;
const ROOT_TOL_DAYS = 1e-8;
const POLISH_H = 1 / (86400 * 20);
/**
 * Hard stop for every horizon scan. The 26 h window at a 2-minute step is
 * 780 samples. A non-positive step used to spin forever, and that loop is
 * synchronous, so Jest's timeout never fires.
 */
const MAX_SEARCH_STEPS = 1024;
const DEG = Math.PI / 180;

const SUN_RADIUS_KM = 695700;
const MOON_RADIUS_KM = 1737.4;

export function riseSetDefinitionFromSettings(
    settings: CalculationSettings = getPreset('jhora-default@8.0'),
    overrides: Partial<RiseSetDefinition> = {},
): RiseSetDefinition {
    return {
        precisionProfile: settings.precisionProfile ?? 'jhora',
        limb: settings.sunrise.limb,
        refraction: settings.sunrise.refraction,
        pressureHPa: 1013.25,
        temperatureC: 15,
        horizonAltitudeDeg: 0,
        positionMode: settings.positionMode,
        ...(settings.deltaTOverrideSeconds !== undefined
            ? { deltaTOverrideSeconds: settings.deltaTOverrideSeconds }
            : {}),
        ...(settings.deltaTForecast === 'oracle-compat'
            ? { deltaTForecast: settings.deltaTForecast }
            : {}),
        ...overrides,
    };
}

function semiDiameterDeg(bodyId: RiseSetBodyId, distAu: number): number {
    const radiusKm = bodyId === 0 ? SUN_RADIUS_KM : bodyId === 1 ? MOON_RADIUS_KM : 0;
    if (radiusKm === 0 || distAu <= 0) return 0;
    const distKm = distAu * AU_KM;
    return Math.asin(radiusKm / distKm) * (180 / Math.PI);
}

function signedDeltaDeg(deg: number): number {
    const wrapped = mod360(deg);
    return wrapped > 180 ? wrapped - 360 : wrapped;
}

function localApparentSiderealDeg(jdUt: number, longitudeEast: number): number {
    return mod360(getGAST(jdUt) + longitudeEast);
}

/**
 * Hour angle east or west of the meridian at which the centre has altitude
 * `contactDeg`. `null` when the parallel of declination does not meet that
 * altitude (circumpolar, or never reaches it).
 */
function contactHourAngleDeg(
    latitudeDeg: number,
    decDeg: number,
    contactDeg: number,
): number | null {
    const lat = latitudeDeg * DEG;
    const dec = decDeg * DEG;
    const cosLat = Math.cos(lat);
    const cosDec = Math.cos(dec);
    if (Math.abs(cosLat) < 1e-12 || Math.abs(cosDec) < 1e-12) return null;
    const cosH = (Math.sin(contactDeg * DEG) - Math.sin(lat) * Math.sin(dec)) / (cosLat * cosDec);
    if (!Number.isFinite(cosH) || Math.abs(cosH) > 1) return null;
    return Math.acos(cosH) * (180 / Math.PI);
}

function placeAt(
    engine: EphemerisEngine,
    jdUt: number,
    bodyId: RiseSetBodyId,
    location: GeoLocation,
    mode: PositionMode,
): { raDeg: number; decDeg: number } {
    return topocentricEquatorialHorizon(engine, jdUt, bodyId, location, mode);
}

/**
 * Next instant at or after `jdStartUt` when the hour angle equals `target`,
 * iterating right ascension. `targetOf` may depend on declination (rise/set);
 * it returns null when that declination does not meet the horizon.
 */
function convergeHourAngle(
    engine: EphemerisEngine,
    bodyId: RiseSetBodyId,
    jdStartUt: number,
    location: GeoLocation,
    mode: PositionMode,
    targetOf: (decDeg: number) => number | null,
): number | null {
    let t = jdStartUt;
    for (let pass = 0; pass < 4; pass++) {
        let failed = false;
        for (let i = 0; i < 8; i++) {
            const { raDeg, decDeg } = placeAt(engine, t, bodyId, location, mode);
            const target = targetOf(decDeg);
            if (target === null) {
                failed = true;
                break;
            }
            const hourAngle = signedDeltaDeg(
                localApparentSiderealDeg(t, location.longitude) - raDeg,
            );
            const error = signedDeltaDeg(hourAngle - target);
            const step = -error / SIDEREAL_DEG_PER_DAY;
            if (!Number.isFinite(step)) return null;
            t += step;
            if (!Number.isFinite(t)) return null;
            if (Math.abs(step) < 0.5 / 86400) break;
        }
        if (failed) return null;
        if (t >= jdStartUt - 0.5 / 86400) return t;
        t += SIDEREAL_DAY;
    }
    return t >= jdStartUt - 0.5 / 86400 ? t : null;
}

function isTransit(event: RiseSetEvent): event is 'upper_transit' | 'lower_transit' {
    return event === 'upper_transit' || event === 'lower_transit';
}

function estimateEvent(
    engine: EphemerisEngine,
    bodyId: RiseSetBodyId,
    event: RiseSetEvent,
    jdStartUt: number,
    location: GeoLocation,
    def: RiseSetDefinition,
): number | null {
    if (isTransit(event)) {
        const target = event === 'upper_transit' ? 0 : 180;
        return convergeHourAngle(engine, bodyId, jdStartUt, location, 'apparent', () => target);
    }
    const mode = riseSetPlaceMode(def, bodyId, location.latitude);
    const contact = def.horizonAltitudeDeg;
    return convergeHourAngle(engine, bodyId, jdStartUt, location, mode, (decDeg) => {
        const half = contactHourAngleDeg(location.latitude, decDeg, contact);
        if (half === null) return null;
        return event === 'rise' ? -half : half;
    });
}

function crossingSense(event: RiseSetEvent, before: number, after: number): boolean {
    if (before * after >= 0) return false;
    if (event === 'rise') return after > before;
    if (event === 'set') return after < before;
    return before < 0 && after >= 0;
}

function bisectRoot(f: (jd: number) => number, t0: number, t1: number): number {
    let lo = t0;
    let hi = t1;
    let flo = f(lo);
    let mid = (lo + hi) / 2;
    for (let i = 0; i < 50; i++) {
        mid = (lo + hi) / 2;
        const fm = f(mid);
        if (flo * fm <= 0) hi = mid;
        else {
            lo = mid;
            flo = fm;
        }
    }
    return mid;
}

function polishRoot(f: (x: number) => number, jd: number): number {
    let x = jd;
    const h = POLISH_H;
    for (let i = 0; i < 8; i++) {
        const y0 = f(x);
        const slope = (f(x + h) - f(x - h)) / (2 * h);
        if (!Number.isFinite(slope) || Math.abs(slope) < 1e-18) break;
        const step = y0 / slope;
        if (!Number.isFinite(step) || Math.abs(step) > 0.01) break;
        x -= step;
        if (Math.abs(step) < 0.2 / 86400) break;
    }
    return x;
}

function solveBracket(f: (jd: number) => number, t0: number, t1: number): number {
    const solved = brent(f, t0, t1, ROOT_TOL_DAYS);
    return polishRoot(f, solved?.root ?? bisectRoot(f, t0, t1));
}

/**
 * Sign change of the right sense nearest `seed`, searched on a window of
 * `halfWindowDays` at `stepDays`. Returns null when the window has no such root.
 */
function localRoot(
    f: (jd: number) => number,
    seed: number,
    event: RiseSetEvent,
    halfWindowDays: number,
    stepDays: number,
): number | null {
    if (!(stepDays > 0) || !Number.isFinite(stepDays) || !Number.isFinite(seed)) return null;
    let prevT = seed - halfWindowDays;
    let prevF = f(prevT);
    let best: [number, number] | null = null;
    let bestDist = Infinity;
    const end = seed + halfWindowDays;
    let steps = 0;
    for (let t = prevT + stepDays; t <= end + 1e-12 && steps < MAX_SEARCH_STEPS; t += stepDays) {
        steps++;
        const fv = f(t);
        if (Number.isFinite(prevF) && Number.isFinite(fv) && crossingSense(event, prevF, fv)) {
            const mid = (prevT + t) / 2;
            const dist = Math.abs(mid - seed);
            if (dist < bestDist) {
                best = [prevT, t];
                bestDist = dist;
            }
        }
        prevT = t;
        prevF = fv;
    }
    if (!best) return null;
    return solveBracket(f, best[0], best[1]);
}

function scanRoot(
    f: (jd: number) => number,
    start: number,
    end: number,
    event: RiseSetEvent,
    samples?: number[],
): number | null {
    const step = 2 / 1440;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    let prevT = start;
    let prevF = f(prevT);
    samples?.push(prevF);
    let steps = 0;
    for (let t = start + step; t <= end + 1e-12 && steps < MAX_SEARCH_STEPS; t += step) {
        steps++;
        const fv = f(t);
        samples?.push(fv);
        if (Number.isFinite(prevF) && Number.isFinite(fv) && crossingSense(event, prevF, fv)) {
            return solveBracket(f, prevT, t);
        }
        prevT = t;
        prevF = fv;
    }
    return null;
}

function polarReason(samples: number[], event: RiseSetEvent): 'polar_day' | 'polar_night' {
    let min = Infinity;
    let max = -Infinity;
    for (const v of samples) {
        if (!Number.isFinite(v)) continue;
        min = Math.min(min, v);
        max = Math.max(max, v);
    }
    if (!(min <= 0)) return event === 'rise' ? 'polar_day' : 'polar_night';
    if (!(max >= 0)) return event === 'rise' ? 'polar_night' : 'polar_day';
    return 'polar_night';
}

function findRiseSetEventInner(
    engine: EphemerisEngine,
    bodyId: RiseSetBodyId,
    event: RiseSetEvent,
    jdStartUt: number,
    location: GeoLocation,
    def: RiseSetDefinition,
): RiseSetOutcome {
    const loc: GeoLocation = {
        latitude: location.latitude,
        longitude: location.longitude,
        altitude: location.altitude ?? 0,
    };
    const transit = isTransit(event);

    const sdAt = (jd: number) => {
        const ecl = engine.getTopocentricTropicalEcliptic(
            jd,
            bodyId,
            loc,
            def.positionMode ?? DEFAULT_POSITION_MODE,
        );
        return semiDiameterDeg(bodyId, ecl.distAu);
    };
    const residual = (jd: number) =>
        transit
            ? transitHourAngleResidual(engine, jd, bodyId, loc, def, event)
            : altitudeMinusTarget(engine, jd, bodyId, loc, def, event, sdAt(jd));

    const windowEnd = jdStartUt + SEARCH_SPAN_DAYS;
    const seed = estimateEvent(engine, bodyId, event, jdStartUt, loc, def);
    let jdUt: number | null = null;
    if (seed !== null && Number.isFinite(seed)) {
        jdUt = localRoot(residual, seed, event, 0.2, 2 / 1440);
        if (jdUt !== null && (jdUt < jdStartUt - 1 / 86400 || jdUt > windowEnd + 1 / 86400)) {
            jdUt = null;
        }
    }
    if (jdUt === null) {
        const samples: number[] = [];
        jdUt = scanRoot(residual, jdStartUt, windowEnd, event, samples);
        if (jdUt === null) {
            return { kind: 'none', reason: polarReason(samples, event) };
        }
    }

    const ms = (jdUt - 2440587.5) * 86400000;
    return { kind: 'time', jdUt, dateTime: DateTime.fromMillis(ms, { zone: 'utc' }) };
}

/**
 * Find the next occurrence of `event` at or after `jdStartUt` (Julian day, UT).
 */
export function findRiseSetEvent(
    engine: EphemerisEngine,
    bodyId: RiseSetBodyId,
    event: RiseSetEvent,
    jdStartUt: number,
    location: GeoLocation,
    def: RiseSetDefinition,
): RiseSetOutcome {
    return withDeltaTContext(
        {
            profile: def.precisionProfile,
            ...(def.deltaTOverrideSeconds !== undefined
                ? { overrideSeconds: def.deltaTOverrideSeconds }
                : {}),
            ...(def.deltaTForecast !== undefined ? { forecast: def.deltaTForecast } : {}),
        },
        () => findRiseSetEventInner(engine, bodyId, event, jdStartUt, location, def),
    );
}

export interface RiseSetTable {
    rise: RiseSetOutcome;
    set: RiseSetOutcome;
    upperTransit: RiseSetOutcome;
    lowerTransit: RiseSetOutcome;
}

/** Convenience: rise, set, and both transits from one start Julian day (UT). */
export function computeRiseSetTable(
    engine: EphemerisEngine,
    bodyId: RiseSetBodyId,
    jdStartUt: number,
    location: GeoLocation,
    def?: RiseSetDefinition,
): RiseSetTable {
    const d = def ?? riseSetDefinitionFromSettings();
    const rise = findRiseSetEvent(engine, bodyId, 'rise', jdStartUt, location, d);
    const setStart = rise.kind === 'time' ? rise.jdUt + STEP : jdStartUt;
    const set = findRiseSetEvent(engine, bodyId, 'set', setStart, location, d);
    const upper = findRiseSetEvent(engine, bodyId, 'upper_transit', jdStartUt, location, d);
    const lower = findRiseSetEvent(engine, bodyId, 'lower_transit', jdStartUt, location, d);
    return { rise, set, upperTransit: upper, lowerTransit: lower };
}

/** Julian day (UT) from a Luxon UTC instant. */
export function jdUtFromDateTime(dt: DateTime): number {
    const u = dt.toUTC();
    return julday(
        u.year,
        u.month,
        u.day,
        u.hour + u.minute / 60 + u.second / 3600 + u.millisecond / 86400000,
    );
}
