// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * ayanamsa-invariable-plane.ts — Solar-system invariable (Laplace) plane coordinates.
 *
 * Longitudes here are measured on the invariable plane: the plane through the
 * solar-system barycentre perpendicular to the total angular-momentum vector
 * (Skvrňanský et al. 2012, A&A 543, A133). The plane is treated as fixed in
 * ICRS; only the **reference direction** for ecliptic longitude (mean equinox
 * of date projected onto the plane) moves with Vondrák et al. (2011) precession
 * from `precession.ts`.
 *
 * Uncertainty / parity
 * ────────────────────
 * Orientation at J2000.0 relative to the mean ecliptic and equinox of J2000.0
 * follows DE405/DE406 in Skvrňanský et al. (2012) Table 4 (ecliptic-equinox
 * columns). Common ephemeris releases that project sidereal longitudes onto this
 * plane sometimes embed node/inclination constants that differ by about 1″ in
 * Ω from that table; combined with star-defined True Citra ayanamsa, total
 * sidereal longitude on this plane can therefore differ by roughly 1″ from such
 * implementations. Precession of the equinox uses Vondrák (2011), not the
 * short IAU 1976/2006 polynomial used in older ayanamsa propagation.
 */

import { deltaT } from './deltat.js';
import {
    julianCenturies,
    matTransposeVec,
    meanEclipticOfDateToIcrf,
    precessionMatrix,
    toSpherical,
    type Vec,
} from './precession.js';

const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// Invariable plane vs mean J2000.0 ecliptic (Skvrňanský et al. 2012, A&A 543,
// A133, Table 4 — DE405/DE406, ecliptic-equinox of J2000.0)
// ---------------------------------------------------------------------------

/** Inclination of the invariable plane to the mean ecliptic of J2000.0, degrees. */
export const INVARIABLE_PLANE_INCLINATION_J2000_ECLIPTIC_DEG = 1 + 34 / 60 + 43.33124 / 3600;

/**
 * Longitude of the ascending node of the invariable plane on the mean J2000.0
 * ecliptic, degrees (equinox of J2000.0).
 */
export const INVARIABLE_PLANE_ASCENDING_NODE_J2000_ECLIPTIC_DEG = 107 + 34 / 60 + 56.17914 / 3600;

/**
 * Same inclination in arcseconds (Table 4: 1°34′43.33124″).
 * @see INVARIABLE_PLANE_INCLINATION_J2000_ECLIPTIC_DEG
 */
export const INVARIABLE_PLANE_INCLINATION_J2000_ECLIPTIC_ARCSEC =
    INVARIABLE_PLANE_INCLINATION_J2000_ECLIPTIC_DEG * 3600;

/**
 * Same node in arcseconds (Table 4: 107°34′56.17914″).
 * @see INVARIABLE_PLANE_ASCENDING_NODE_J2000_ECLIPTIC_DEG
 */
export const INVARIABLE_PLANE_ASCENDING_NODE_J2000_ECLIPTIC_ARCSEC =
    INVARIABLE_PLANE_ASCENDING_NODE_J2000_ECLIPTIC_DEG * 3600;

/** Julian Day (TT) of J2000.0 — Capitaine & Wallace (2012), erratum to Vondrák et al. (2011). */
export const J2000_JD_TT = 2451545.0;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function dot(a: Vec, b: Vec): number {
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec, b: Vec): Vec {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(v: Vec): Vec {
    const n = Math.hypot(v[0], v[1], v[2]);
    if (n === 0) return [0, 0, 1];
    return [v[0] / n, v[1] / n, v[2] / n];
}

function projectOntoPlane(v: Vec, planeNormalUnit: Vec): Vec {
    const k = dot(v, planeNormalUnit);
    return [
        v[0] - k * planeNormalUnit[0],
        v[1] - k * planeNormalUnit[1],
        v[2] - k * planeNormalUnit[2],
    ];
}

/** Unit normal to the invariable plane in ICRS (fixed). */
function invariablePlaneNormalIcrf(): Vec {
    const i = INVARIABLE_PLANE_INCLINATION_J2000_ECLIPTIC_DEG * DEG;
    const om = INVARIABLE_PLANE_ASCENDING_NODE_J2000_ECLIPTIC_DEG * DEG;
    const sinI = Math.sin(i);
    const cosI = Math.cos(i);
    const sinOm = Math.sin(om);
    const cosOm = Math.cos(om);
    const nEcl: Vec = [sinI * sinOm, -sinI * cosOm, cosI];
    return normalize(meanEclipticOfDateToIcrf(nEcl, 0, J2000_JD_TT));
}

/** Unit vector along the J2000 ascending node (ecliptic ∩ invariable), in ICRF. */
function invariableNodeDirectionIcrf(): Vec {
    const om = INVARIABLE_PLANE_ASCENDING_NODE_J2000_ECLIPTIC_DEG * DEG;
    const tEcl: Vec = [Math.cos(om), Math.sin(om), 0];
    return normalize(meanEclipticOfDateToIcrf(tEcl, 0, J2000_JD_TT));
}

/**
 * Right-handed basis of the invariable plane in ICRS: x = equinox of date on the
 * plane, y = z × x, z = fixed invariable normal (north side of the plane).
 */
function invariableBasisIcrf(T: number, jdTT: number): { x: Vec; y: Vec; z: Vec } {
    const z = invariablePlaneNormalIcrf();
    const vernalIcrf = normalize(matTransposeVec(precessionMatrix(T, jdTT), [1, 0, 0]));
    let x = projectOntoPlane(vernalIcrf, z);
    let xLen = Math.hypot(x[0], x[1], x[2]);
    if (xLen < 1e-14) {
        x = projectOntoPlane(invariableNodeDirectionIcrf(), z);
        xLen = Math.hypot(x[0], x[1], x[2]);
    }
    x = xLen === 0 ? [1, 0, 0] : [x[0] / xLen, x[1] / xLen, x[2] / xLen];
    const y = normalize(cross(z, x));
    return { x, y, z };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Express an ICRF direction in the solar-system invariable plane coordinate
 * system at TT epoch `jdTT`.
 *
 * The returned vector is `(v·x, v·y, v·z)` where x, y, z are the invariable
 * basis in ICRS (not necessarily unit length if `vec` is not a direction).
 */
export function icrfToInvariableEcliptic(vec: Vec, jdTT: number): Vec {
    const T = julianCenturies(jdTT);
    const { x, y, z } = invariableBasisIcrf(T, jdTT);
    return [dot(vec, x), dot(vec, y), dot(vec, z)];
}

/**
 * Ecliptic longitude (degrees, [0, 360)) on the invariable plane of date for
 * an ICRF direction `vec`. Uses `deltaT` to convert UT → TT.
 */
export function invariableEclipticLongitude(vec: Vec, jdUT: number): number {
    const jdTT = jdUT + deltaT(jdUT) / 86400.0;
    const r = Math.hypot(vec[0], vec[1], vec[2]);
    const dir: Vec = r === 0 ? [1, 0, 0] : [vec[0] / r, vec[1] / r, vec[2] / r];
    return toSpherical(icrfToInvariableEcliptic(dir, jdTT)).lon;
}
