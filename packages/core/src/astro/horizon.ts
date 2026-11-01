// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Topocentric horizontal coordinates for rise, set, and culmination.
 *
 * The place is equatorial of the true equinox of date: the IAU 2000 frame
 * bias (IERS Conventions 2010, §5.4.5 and §5.9; dα₀ eq. 5.21, ξ₀ and η₀
 * eq. 5.33), then nutation in longitude and the
 * true obliquity. Chart longitudes stay on the ICRF. The hour angle uses
 * Greenwich apparent sidereal time, so the equation of the equinoxes is not
 * left in the hour angle.
 * Formulas: Meeus, Astronomical Algorithms, ch. 13 (equatorial transformation)
 * and the Explanatory Supplement (nutation, topocentric parallax, sidereal time).
 *
 * Which disc sits on the horizon is an observed property of each oracle.
 * See ADR 0009. The jhora oracle is the geometric disc at every latitude.
 * The modern oracle is the apparent disc, except the Sun above 65° geographic
 * latitude and every other body above 60°, where it is the geometric disc.
 */

import { getGAST, mod360 } from '../engine/coordinates.js';
import {
    DEFAULT_POSITION_MODE,
    EphemerisEngine,
    type GeoLocation,
    type PositionMode,
} from '../engine/ephemeris.js';
import { refractionDegrees } from './refraction.js';
import type { RiseSetDefinition, RiseSetEvent } from './riseset.js';

const DEG = Math.PI / 180;

/** Sun switches to the geometric disc above this geographic latitude. */
export const MODERN_SUN_GEOMETRIC_LATITUDE_DEG = 65;

/** Every body other than the Sun switches above this geographic latitude. */
export const MODERN_BODY_GEOMETRIC_LATITUDE_DEG = 60;

export function equatorialFromEcliptic(
    lonDeg: number,
    latDeg: number,
    epsTrueDeg: number,
): { raDeg: number; decDeg: number } {
    const eps = epsTrueDeg * DEG;
    const lon = lonDeg * DEG;
    const lat = latDeg * DEG;
    const sinDec = Math.sin(lat) * Math.cos(eps) + Math.cos(lat) * Math.sin(eps) * Math.sin(lon);
    const dec = Math.asin(sinDec);
    const y = Math.sin(lon) * Math.cos(eps) - Math.tan(lat) * Math.sin(eps);
    const x = Math.cos(lon);
    const ra = Math.atan2(y, x) * (180 / Math.PI);
    return { raDeg: mod360(ra), decDeg: dec * (180 / Math.PI) };
}

/**
 * Dip of the sea horizon, degrees, negative when the observer is above sea level.
 *
 * The Nautical Almanac (UKHO / USNO) gives the dip as 1.76 arcminutes times
 * the square root of the height in metres. That is the geometric dip
 * √(2h/R) ≈ 1.93′ √h(m) from the Explanatory Supplement, reduced by a mean
 * terrestrial-refraction factor of about 0.92.
 */
export function horizonDipDeg(heightM: number): number {
    if (!(heightM > 0)) return 0;
    return (-1.76 * Math.sqrt(heightM)) / 60;
}

export function topocentricEquatorialHorizon(
    engine: EphemerisEngine,
    jdUt: number,
    bodyId: number,
    location: GeoLocation,
    positionMode: PositionMode = DEFAULT_POSITION_MODE,
): { raDeg: number; decDeg: number; distAu: number } {
    const eq = engine.getTopocentricEquatorial(jdUt, bodyId, location, positionMode);
    return { raDeg: eq.raDeg, decDeg: eq.decDeg, distAu: eq.distAu };
}

/**
 * Place whose altitude is zero at rise and set.
 *
 * Thresholds are the observed behaviour of the modern oracle (ADR 0009):
 * the Sun for |φ| > 65°, and every other body for |φ| > 60°, uses the
 * geometric disc the caller asked for. Below those limits the modern oracle
 * puts the apparent disc on the horizon. The jhora oracle does not switch.
 */
export function riseSetPlaceMode(
    def: RiseSetDefinition,
    bodyId: number,
    latitudeDeg: number,
): PositionMode {
    const requested = def.positionMode ?? DEFAULT_POSITION_MODE;
    if (def.precisionProfile !== 'modern') return requested;
    if (requested === 'apparent') return 'apparent';
    const limit =
        bodyId === 0 ? MODERN_SUN_GEOMETRIC_LATITUDE_DEG : MODERN_BODY_GEOMETRIC_LATITUDE_DEG;
    if (Math.abs(latitudeDeg) > limit) return 'geometric';
    return 'apparent';
}

function signedHourAngleDeg(lstDeg: number, raDeg: number): number {
    const ha = mod360(lstDeg - raDeg);
    return ha > 180 ? ha - 360 : ha;
}

function sphereAltitudeDeg(
    jdUt: number,
    raDeg: number,
    decDeg: number,
    location: GeoLocation,
): number {
    const lst = mod360(getGAST(jdUt) + location.longitude);
    const ha = signedHourAngleDeg(lst, raDeg);
    const lat = location.latitude * DEG;
    const dec = decDeg * DEG;
    const haR = ha * DEG;
    return (
        Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(haR)) *
        (180 / Math.PI)
    );
}

export function trueGeometricAltitudeDeg(
    jdUt: number,
    raDeg: number,
    decDeg: number,
    location: GeoLocation,
): number {
    return sphereAltitudeDeg(jdUt, raDeg, decDeg, location);
}

/**
 * Geometric altitude of the chosen limb on the horizon, degrees.
 * Dip is included only when refraction is on: with refraction off, the
 * jhora oracle (including elevated sites) is the unrefracted geometric horizon.
 */
export function geometricContactDeg(
    event: RiseSetEvent,
    def: RiseSetDefinition,
    semiDiamDeg: number,
    heightM: number,
): number {
    if (event === 'upper_transit' || event === 'lower_transit') {
        return def.horizonAltitudeDeg;
    }
    let h = def.horizonAltitudeDeg;
    if (def.limb === 'upper_limb') {
        h = event === 'rise' ? h - semiDiamDeg : h + semiDiamDeg;
    }
    if (def.refraction) h += horizonDipDeg(heightM);
    return h;
}

export function altitudeMinusTarget(
    engine: EphemerisEngine,
    jdUt: number,
    bodyId: number,
    location: GeoLocation,
    def: RiseSetDefinition,
    event: RiseSetEvent,
    semiDiamDeg: number,
): number {
    const mode = riseSetPlaceMode(def, bodyId, location.latitude);
    const { raDeg, decDeg } = topocentricEquatorialHorizon(engine, jdUt, bodyId, location, mode);
    const geo = trueGeometricAltitudeDeg(jdUt, raDeg, decDeg, location);
    const target = geometricContactDeg(event, def, semiDiamDeg, location.altitude ?? 0);
    if (!def.refraction) return geo - target;
    const apparent = geo + refractionDegrees(geo, def.pressureHPa, def.temperatureC);
    return apparent - target;
}

export function transitHourAngleResidual(
    engine: EphemerisEngine,
    jdUt: number,
    bodyId: number,
    location: GeoLocation,
    _def: RiseSetDefinition,
    event: 'upper_transit' | 'lower_transit',
): number {
    // Both oracles culminate the apparent right ascension against local
    // apparent sidereal time, including when rise/set was requested geometric.
    const { raDeg } = topocentricEquatorialHorizon(engine, jdUt, bodyId, location, 'apparent');
    const lst = mod360(getGAST(jdUt) + location.longitude);
    if (event === 'upper_transit') {
        return signedHourAngleDeg(lst, raDeg);
    }
    let d = mod360(lst - raDeg - 180);
    if (d > 180) d -= 360;
    return d;
}
