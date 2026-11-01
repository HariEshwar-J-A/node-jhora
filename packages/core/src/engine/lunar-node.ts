/**
 * True (osculating) lunar node on the mean ecliptic and equinox of date.
 *
 * Clean-room model (Q1, nodes2 brief): geometric geocentric Moon r,v from JPL
 * DE440/DE441; optional JHora-only ICRS x-tilt from published ε₀ difference;
 * IERS 2003 / IAU 2000 frame bias on r and v; Vondrák 2011 precession + ε_A;
 * same rotation on r and v with no frame spin; ascending node from h = r × v.
 *
 * @provenance IERS Conventions (2010) §5.4.5 frame bias; Vondrák et al. (2011);
 * Capitaine et al. (2003) ε_A; Vallado (4th ed.) §2.4 node longitude and §2.6
 * osculating radius at the node; DE440 NAIF GM values.
 */

import type { BarycentricSource } from './apparent.js';
import { AU_KM, observerState } from './apparent.js';
import { mod360 } from './coordinates.js';
import {
    deltaT,
    jdTdbPartsFromUt,
    jdUTtoET,
    type PrecisionProfile,
    subtractLightTimeFromTdbParts,
} from './deltat.js';
import {
    APPARENT_SPEED_STEP_DAYS,
    etSecondsPerUtDay,
    geocentricRelativeState,
} from './kinematics.js';
import { nutation, nutationForProfile } from './nutation.js';
import {
    iau2000FrameBias,
    icrfToMeanEclipticOfDate,
    icrfToMeanEclipticOfDateForProfile,
    julianCenturies,
    rotateX,
    type Vec,
} from './precession.js';
import { NAIF } from './spk.js';

/** Speed of light, km/s (IAU / SI exact). */
const C_KM_S = 299792.458;

/** J2000 mean obliquity at epoch (arcsec), IAU 1976 / Explanatory Supplement. */
export const EPS0_IAU1976_ARCSEC = 84381.448;
/** J2000 mean obliquity at epoch (arcsec), IAU 2006 / Capitaine et al. (2003). */
export const EPS0_IAU2006_ARCSEC = 84381.406;

/**
 * JHora file-Moon compatibility: + rotation about ICRS x (published ε₀ difference).
 * Modern profile does not apply this.
 */
export function jhoraMoonIcrsTiltDegrees(): number {
    return (EPS0_IAU1976_ARCSEC - EPS0_IAU2006_ARCSEC) / 3600;
}

/** GM⊕ and GM☾ (km³/s²), DE440 / NAIF planetary constants. */
const GM_EARTH_KM3_S2 = 398600.435436;
const GM_MOON_KM3_S2 = 4902.800066;
/** μ = G(M⊕ + M☾) for the geocentric two-body Moon orbit. */
const GM_EARTH_MOON_KM3_S2 = GM_EARTH_KM3_S2 + GM_MOON_KM3_S2;

/** Light-time true-node speed FD (TN-B11): 1e-4 d matches retardation scale. */
export const TRUE_NODE_SPEED_STEP_DAYS = 1e-4;

/**
 * Oracle / Swiss-style true-node **speed** is not the time derivative of the Q1
 * node longitude (frame bias + JHora Moon tilt on place). Black-box probes show
 * the fourth component matches central difference on the legacy osculating chain:
 * geometric Moon r,v → mean ecliptic of date without IERS frame bias and without
 * the JHora ε₀ tilt, at {@link APPARENT_SPEED_STEP_DAYS} (ADR 0008 / pre-Q1 engine).
 * Q1 **positions** keep bias + tilt; only speed uses this step.
 */
export const TRUE_NODE_SPEED_LEGACY_FD_STEP_DAYS = APPARENT_SPEED_STEP_DAYS;

/** @deprecated Probe-only; production uses {@link computeTrueOsculatingNode}. */
export type TrueNodeEclipticFrame =
    'mean_ecliptic_of_date' | 'true_obliquity_ecliptic' | 'j2000_mean_ecliptic';

/** @deprecated Probe-only. */
export type TrueNodeVelocityMode = 'spk_analytic' | 'fd_1s' | 'fd_60s';

export interface TrueNodeOptions {
    /** @deprecated Use {@link computeTrueOsculatingNode}. */
    eclipticFrame?: TrueNodeEclipticFrame;
    /** @deprecated Use {@link computeTrueOsculatingNode}. */
    velocityMode?: TrueNodeVelocityMode;
    /** @deprecated Production node never uses spin. */
    precessionSpin?: boolean;
    precisionProfile?: PrecisionProfile;
    /** When false, evaluate at jd − |r|/c (one-shot light-time retardation). */
    truePosition?: boolean;
    /** Apparent node: add IAU 2000A Δψ to nutation-free longitude (latitude stays 0). */
    applyNutation?: boolean;
}

export interface TrueOsculatingNode {
    /** Tropical mean ecliptic of date, degrees. */
    lon: number;
    /** Osculating radius at the ascending node, AU. */
    distAu: number;
    /**
     * Tropical nutation-free longitude rate, deg/day.
     * Geometric TRUEPOS: legacy-chain central difference at 1 s; light-time: 1e-4 d
     * on the Q1 place chain.
     */
    speedDegPerDay: number;
}

const dot3 = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross3 = (a: Vec, b: Vec): Vec => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];
const norm3 = (a: Vec): number => Math.hypot(a[0], a[1], a[2]);

function ascendingNodeLongitudeFromEclipticState(pos: Vec, vel: Vec): number {
    const hx = pos[1] * vel[2] - pos[2] * vel[1];
    const hy = pos[2] * vel[0] - pos[0] * vel[2];
    return mod360((Math.atan2(hx, -hy) * 180) / Math.PI);
}

/** ICRS km (or km/day) → mean ecliptic of date; truth uses ecm06 only (bias already inside). */
function icrfBiasedToMeanEcliptic(
    v: Vec,
    T: number,
    jdTT: number,
    profile: PrecisionProfile | undefined,
): Vec {
    const src = profile === 'truth' ? v : iau2000FrameBias(v);
    return icrfToMeanEclipticOfDateForProfile(src, T, jdTT, profile ?? 'jhora');
}

function geocentricMoonStateTruthLightTime(
    jdUT: number,
    source: BarycentricSource,
    profile: PrecisionProfile | undefined,
): { rel: Vec; vel: Vec } {
    const parts = profile === 'truth' && source.getBarycentricAtTdb ? jdTdbPartsFromUt(jdUT) : null;
    if (parts && source.getBarycentricAtTdb) {
        const earth = source.getBarycentricAtTdb(NAIF.Earth, parts.D, parts.f);
        const moon0 = source.getBarycentricAtTdb(NAIF.Moon, parts.D, parts.f);
        const rel0: Vec = [moon0.x - earth.x, moon0.y - earth.y, moon0.z - earth.z];
        const v0: Vec = [moon0.vx - earth.vx, moon0.vy - earth.vy, moon0.vz - earth.vz];
        applyJhoraMoonTilt(profile, rel0, v0);
        const tauSec = norm3(rel0) / C_KM_S;
        const ret = subtractLightTimeFromTdbParts(parts.D, parts.f, tauSec);
        const moon = source.getBarycentricAtTdb(NAIF.Moon, ret.D, ret.f);
        const rel: Vec = [moon.x - earth.x, moon.y - earth.y, moon.z - earth.z];
        const vel: Vec = [moon.vx - earth.vx, moon.vy - earth.vy, moon.vz - earth.vz];
        applyJhoraMoonTilt(profile, rel, vel);
        return { rel, vel };
    }

    const etRecv = jdUTtoET(jdUT);
    const earthObs = observerState(source, NAIF.Earth, etRecv);
    const { rel: rel0, vel: v0 } = geocentricRelativeState(source, NAIF.Moon, etRecv, earthObs);
    applyJhoraMoonTilt(profile, rel0, v0);
    const tauDays = norm3(rel0) / C_KM_S / 86400;
    const etMoon = jdUTtoET(jdUT - tauDays);
    const { rel, vel } = geocentricRelativeState(source, NAIF.Moon, etMoon, earthObs);
    applyJhoraMoonTilt(profile, rel, vel);
    return { rel, vel };
}

function applyJhoraMoonTilt(profile: PrecisionProfile | undefined, rel: Vec, vel: Vec): void {
    if (profile !== 'jhora') return;
    const tilt = jhoraMoonIcrsTiltDegrees();
    const r2 = rotateX(rel, tilt);
    const v2 = rotateX(vel, tilt);
    rel[0] = r2[0];
    rel[1] = r2[1];
    rel[2] = r2[2];
    vel[0] = v2[0];
    vel[1] = v2[1];
    vel[2] = v2[2];
}

function geocentricMoonStateAtEt(
    jdUT: number,
    source: BarycentricSource,
    profile: PrecisionProfile | undefined,
): { rel: Vec; vel: Vec } {
    const et = jdUTtoET(jdUT);
    const observer = observerState(source, NAIF.Earth, et);
    const { rel, vel } = geocentricRelativeState(source, NAIF.Moon, et, observer);
    applyJhoraMoonTilt(profile, rel, vel);
    return { rel, vel };
}

function eclipticStateFromIcrfBiased(
    relKm: Vec,
    relVelKmS: Vec,
    jdUT: number,
    profile: PrecisionProfile | undefined,
): { pos: Vec; vel: Vec } {
    const jdTT = jdUT + deltaT(jdUT) / 86400;
    const T = julianCenturies(jdTT);
    const secPerDay = etSecondsPerUtDay(jdUT);
    const velKmDay: Vec = [
        relVelKmS[0] * secPerDay,
        relVelKmS[1] * secPerDay,
        relVelKmS[2] * secPerDay,
    ];
    return {
        pos: icrfBiasedToMeanEcliptic(relKm, T, jdTT, profile),
        vel: icrfBiasedToMeanEcliptic(velKmDay, T, jdTT, profile),
    };
}

/**
 * Osculating semi-latus rectum / (1 + e·cos ω) at the ascending node (Vallado §2.6).
 * `pos` km, `vel` km/day in the mean ecliptic of date.
 */
function osculatingRadiusAtAscendingNodeKm(pos: Vec, vel: Vec, secPerDay: number): number {
    const v: Vec = [vel[0] / secPerDay, vel[1] / secPerDay, vel[2] / secPerDay];
    const r = pos;
    const mu = GM_EARTH_MOON_KM3_S2;
    const h = cross3(r, v);
    const h2 = dot3(h, h);
    const rm = norm3(r);
    if (rm === 0 || h2 === 0) return rm;

    const vm2 = dot3(v, v);
    const p = h2 / mu;
    const rdv = dot3(r, v);
    const f = (vm2 - mu / rm) / mu;
    const eVec: Vec = [
        f * r[0] - (rdv / mu) * v[0],
        f * r[1] - (rdv / mu) * v[1],
        f * r[2] - (rdv / mu) * v[2],
    ];
    const e = norm3(eVec);
    if (e < 1e-12) return p;

    const nVec: Vec = [-h[1], h[0], 0];
    const nMag = Math.hypot(nVec[0], nVec[1]);
    if (nMag < 1e-12) return rm;
    const cosW = dot3(eVec, [nVec[0] / nMag, nVec[1] / nMag, 0]) / e;
    const cw = Math.max(-1, Math.min(1, cosW));
    return p / (1 + e * cw);
}

function trueNodeLongitudeAtJd(
    jdUT: number,
    source: BarycentricSource,
    profile: PrecisionProfile | undefined,
    applyNutation: boolean,
    useTruthLightTime: boolean,
): { lon: number; distAu: number } {
    const { rel, vel } = useTruthLightTime
        ? geocentricMoonStateTruthLightTime(jdUT, source, profile)
        : geocentricMoonStateAtEt(jdUT, source, profile);
    const secPerDay = etSecondsPerUtDay(jdUT);
    const { pos, vel: vEcl } = eclipticStateFromIcrfBiased(rel, vel, jdUT, profile);
    let lon = ascendingNodeLongitudeFromEclipticState(pos, vEcl);
    if (applyNutation) {
        const T = julianCenturies(jdUT + deltaT(jdUT) / 86400);
        const dpsi = profile === 'truth' ? nutationForProfile(T, 'truth').dpsi : nutation(T).dpsi;
        lon = mod360(lon + dpsi);
    }
    const distKm = osculatingRadiusAtAscendingNodeKm(pos, vEcl, secPerDay);
    return { lon, distAu: distKm / AU_KM };
}

/**
 * Legacy osculating node longitude for **speed** only (pre-Q1 / oracle SPEED chain):
 * no IERS frame bias, no JHora Moon tilt, no precession spin on velocity.
 */
function trueNodeLongitudeLegacySpeedChainAtJd(jdUT: number, source: BarycentricSource): number {
    const et = jdUTtoET(jdUT);
    const observer = observerState(source, NAIF.Earth, et);
    const { rel, vel } = geocentricRelativeState(source, NAIF.Moon, et, observer);
    const jdTT = jdUT + deltaT(jdUT) / 86400;
    const T = julianCenturies(jdTT);
    const secPerDay = etSecondsPerUtDay(jdUT);
    const velKmDay: Vec = [vel[0] * secPerDay, vel[1] * secPerDay, vel[2] * secPerDay];
    const pos = icrfToMeanEclipticOfDate(rel, T, jdTT);
    const vEcl = icrfToMeanEclipticOfDate(velKmDay, T, jdTT);
    return ascendingNodeLongitudeFromEclipticState(pos, vEcl);
}

function centralDifferenceLongitudeDegPerDay(
    lonAt: (jdUT: number) => number,
    jdUT: number,
    h: number,
): number {
    let dLon = lonAt(jdUT + h) - lonAt(jdUT - h);
    if (dLon > 180) dLon -= 360;
    if (dLon < -180) dLon += 360;
    return dLon / (2 * h);
}

function evaluationJdForNode(
    jdUT: number,
    source: BarycentricSource,
    profile: PrecisionProfile | undefined,
    truePosition: boolean,
): number {
    if (truePosition) return jdUT;
    if (profile === 'truth') return jdUT;
    const { rel } = geocentricMoonStateAtEt(jdUT, source, profile);
    const tauDays = norm3(rel) / C_KM_S / 86400;
    return jdUT - tauDays;
}

/**
 * True osculating ascending node (tropical mean ecliptic of date).
 */
export function computeTrueOsculatingNode(
    jdUT: number,
    source: BarycentricSource,
    options: TrueNodeOptions = {},
): TrueOsculatingNode {
    const { precisionProfile, truePosition = true, applyNutation = false } = options;

    const truthLt = precisionProfile === 'truth' && !truePosition && applyNutation;
    const evalJd = evaluationJdForNode(jdUT, source, precisionProfile, truePosition);
    const { lon, distAu } = trueNodeLongitudeAtJd(
        evalJd,
        source,
        precisionProfile,
        applyNutation,
        truthLt,
    );

    let speedDegPerDay: number;
    if (truePosition) {
        const h = TRUE_NODE_SPEED_LEGACY_FD_STEP_DAYS;
        const legacyLon = (jd: number) => trueNodeLongitudeLegacySpeedChainAtJd(jd, source);
        speedDegPerDay = centralDifferenceLongitudeDegPerDay(legacyLon, jdUT, h);
    } else {
        const h = TRUE_NODE_SPEED_STEP_DAYS;
        const lonAt = (jd: number) =>
            trueNodeLongitudeAtJd(
                evaluationJdForNode(jd, source, precisionProfile, false),
                source,
                precisionProfile,
                false,
                precisionProfile === 'truth',
            ).lon;
        speedDegPerDay = centralDifferenceLongitudeDegPerDay(lonAt, jdUT, h);
    }

    return { lon, distAu, speedDegPerDay };
}

/**
 * Tropical ascending-node longitude (legacy entry; prefer {@link computeTrueOsculatingNode}).
 */
export function trueAscendingNodeLongitude(
    jdUT: number,
    source: BarycentricSource,
    options: TrueNodeOptions = {},
): number {
    const {
        eclipticFrame = 'mean_ecliptic_of_date',
        velocityMode = 'spk_analytic',
        precessionSpin = false,
        precisionProfile = 'modern',
        truePosition = true,
        applyNutation = false,
    } = options;

    if (
        eclipticFrame !== 'mean_ecliptic_of_date' ||
        velocityMode !== 'spk_analytic' ||
        precessionSpin
    ) {
        return computeTrueOsculatingNode(jdUT, source, {
            precisionProfile,
            truePosition,
            applyNutation,
        }).lon;
    }

    return computeTrueOsculatingNode(jdUT, source, {
        precisionProfile,
        truePosition,
        applyNutation,
    }).lon;
}
