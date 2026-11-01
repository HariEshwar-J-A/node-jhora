// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * kinematics.ts — Daily motions from DE Chebyshev velocities.
 *
 * Swiss Ephemeris derives speeds from the ephemeris velocity (Chebyshev
 * derivative of the SPK Type-2 record) propagated through the same
 * apparent-place chain as the position, not from a coarse finite-difference
 * step on longitude. A 0.25-day central difference leaves the Moon ~5.7″/day
 * high and Mercury ~1.5″/day high versus SE 2.02 / pyswisseph 2.10.
 *
 * Geometric places (JHora TRUEPOS default): analytic ∂(place)/∂t using SPK
 * v, IAU 2006 precession spin, and spherical Jacobian.
 *
 * Apparent places (light-time + deflection + aberration): symmetric
 * difference on the final mean-ecliptic longitude with
 * {@link APPARENT_SPEED_STEP_DAYS} (1 s), documented to stay <0.01″/day
 * versus iterative apparent place at chart epochs.
 */

import type { BarycentricSource, ObserverState, PlaceCorrections } from './apparent.js';
import { AU_KM } from './apparent.js';
import { deltaT } from './deltat.js';
import { icrfToMeanEclipticOfDate, julianCenturies, type Vec } from './precession.js';

/** UT day → TT day offset derivative, seconds per UT day (ΔT slope). */
function deltaTSecondsPerUtDay(jdUT: number): number {
    const h = 1e-4;
    return (deltaT(jdUT + h) - deltaT(jdUT - h)) / (2 * h);
}

/** Ephemeris seconds per UT day (TT + ΔT chain). */
export function etSecondsPerUtDay(jdUT: number): number {
    return 86400 + deltaTSecondsPerUtDay(jdUT);
}

/** Julian centuries (TT) per UT day. */
function ttCenturiesPerUtDay(jdUT: number): number {
    return (1 + deltaTSecondsPerUtDay(jdUT) / 86400) / 36525;
}

const dot3 = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

function add3(a: Vec, b: Vec): Vec {
    return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale3(a: Vec, s: number): Vec {
    return [a[0] * s, a[1] * s, a[2] * s];
}

/** dû/dt for r, v in consistent length/time units (û = r/|r|). */
export function unitVectorDerivative(r: Vec, v: Vec): Vec {
    const r2 = dot3(r, r);
    const rMag = Math.sqrt(r2);
    if (rMag === 0) return [0, 0, 0];
    const rdv = dot3(r, v);
    return scale3(add3(v, scale3(r, -rdv / r2)), 1 / rMag);
}

/**
 * Mean ecliptic of date position (km) and velocity (km/UT-day) from ICRF
 * barycentric relative state.
 */
export function meanEclipticRelativeKinematics(
    relKm: Vec,
    relVelKmS: Vec,
    jdUT: number,
): { pos: Vec; vel: Vec } {
    const secPerDay = etSecondsPerUtDay(jdUT);
    const velKmDay = scale3(relVelKmS, secPerDay);
    const jdTT = jdUT + deltaT(jdUT) / 86400;
    const T = julianCenturies(jdTT);
    const dTdt = ttCenturiesPerUtDay(jdUT);

    const pos = icrfToMeanEclipticOfDate(relKm, T, jdTT);
    const velFromBody = icrfToMeanEclipticOfDate(velKmDay, T, jdTT);

    // Frame spin: ∂R/∂T · dT/dt applied to the position vector (Vondrák 2011 needs jdTT).
    const hT = 1e-9;
    const jdPlus = jdTT + hT * 36525;
    const jdMinus = jdTT - hT * 36525;
    const spin: Vec = [
        ((icrfToMeanEclipticOfDate(relKm, T + hT, jdPlus)[0] -
            icrfToMeanEclipticOfDate(relKm, T - hT, jdMinus)[0]) /
            (2 * hT)) *
            dTdt,
        ((icrfToMeanEclipticOfDate(relKm, T + hT, jdPlus)[1] -
            icrfToMeanEclipticOfDate(relKm, T - hT, jdMinus)[1]) /
            (2 * hT)) *
            dTdt,
        ((icrfToMeanEclipticOfDate(relKm, T + hT, jdPlus)[2] -
            icrfToMeanEclipticOfDate(relKm, T - hT, jdMinus)[2]) /
            (2 * hT)) *
            dTdt,
    ];

    return { pos, vel: add3(velFromBody, spin) };
}

/** Spherical rates (deg/day, AU/day) from Cartesian ecliptic state. */
export function sphericalRatesDegPerDay(
    pos: Vec,
    vel: Vec,
): {
    lon: number;
    lat: number;
    dist: number;
} {
    const x = pos[0];
    const y = pos[1];
    const z = pos[2];
    const dx = vel[0];
    const dy = vel[1];
    const dz = vel[2];

    const rho2 = x * x + y * y;
    const rho = Math.sqrt(rho2);
    const r2 = rho2 + z * z;
    const r = Math.sqrt(r2);

    const lonRate = rho2 > 0 ? ((x * dy - y * dx) / rho2) * (180 / Math.PI) : 0;

    const dr = r > 0 ? (x * dx + y * dy + z * dz) / r : 0;
    let latRate = 0;
    if (r > 0 && rho > 0) {
        const cosLat = rho / r;
        latRate = cosLat === 0 ? 0 : (((r * dz - z * dr) / r2) * (180 / Math.PI)) / cosLat;
    }
    const distRate = dr / AU_KM;

    return { lon: lonRate, lat: latRate, dist: distRate };
}

/**
 * Geocentric relative barycentric state (km, km/s) for target vs observer.
 */
export function geocentricRelativeState(
    spk: BarycentricSource,
    targetNaif: number,
    et: number,
    observer: ObserverState,
): { rel: Vec; vel: Vec } {
    const b = spk.getBarycentric(targetNaif, et);
    return {
        rel: [b.x - observer.position[0], b.y - observer.position[1], b.z - observer.position[2]],
        vel: [
            b.vx - observer.velocity[0],
            b.vy - observer.velocity[1],
            b.vz - observer.velocity[2],
        ],
    };
}

/** True if all apparent-place corrections are off (JHora geometric / TRUEPOS). */
export function isGeometricPlace(corrections: Required<PlaceCorrections>): boolean {
    return !corrections.lightTime && !corrections.deflection && !corrections.aberration;
}

/**
 * Half-step for apparent-place longitude speed (days). 1 s UT — small enough
 * that the Moon's longitude curvature contributes <0.01″/day in central
 * difference at DE440s epochs.
 */
export const APPARENT_SPEED_STEP_DAYS = 1 / 86400;
