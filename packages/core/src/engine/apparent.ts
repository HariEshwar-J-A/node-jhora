/**
 * apparent.ts — Geometric ephemeris state → apparent place.
 *
 * Turns raw DE440 barycentric vectors into the direction an observer actually
 * sees, applying, in the order the corrections physically occur:
 *
 *   1. Light-time    — the body is seen where it *was* when the light left it.
 *                      Solved iteratively; the observer stays at epoch t.
 *   2. Deflection    — solar gravity bends the ray (≤1.75″ at the solar limb,
 *                      ~0.004″ at 90° elongation).
 *   3. Aberration    — the observer's barycentric velocity tilts the apparent
 *                      direction by up to 20.5″.
 *
 * The previous implementation had none of these working: light-time was
 * computed in *days* and then subtracted from an epoch expressed in *seconds*,
 * so the correction was ~86400× too small and effectively absent, and neither
 * aberration nor deflection existed at all. Together those accounted for most
 * of the 7–41″ error measured against JPL Horizons.
 *
 * Output is an ICRF equatorial unit vector plus true geometric distance; the
 * caller rotates it into whichever ecliptic frame it needs.
 */

import type { Vec3 } from './chebyshev.js';
import type { Vec } from './precession.js';

/** Speed of light, km/s (IAU / SI exact). */
const C_KM_S = 299792.458;

/** Astronomical unit, km (IAU 2012). */
export const AU_KM = 149597870.7;

/**
 * Schwarzschild radius factor 2·GM☉/c², in km.
 * GM☉ = 1.32712440018e11 km³/s² (IAU 2009).
 */
const SUN_2GM_C2 = 2 * 1.32712440018e11 / (C_KM_S * C_KM_S);

/** Minimal slice of SpkFile that this module needs. */
export interface BarycentricSource {
    getBarycentric(naifBody: number, et: number): Vec3;
}

export interface ApparentPlace {
    /** Apparent direction as an ICRF equatorial unit vector. */
    direction: Vec;
    /** Geometric distance observer → body at emission, in AU. */
    distanceAU: number;
    /** Light-time in seconds. */
    lightTimeSec: number;
}

export interface ObserverState {
    /** Barycentric position, km (ICRF equatorial). */
    position: Vec;
    /** Barycentric velocity, km/s (ICRF equatorial). */
    velocity: Vec;
}

/**
 * Which of the three corrections to apply.
 *
 * Astronomy defaults to all three ("apparent place" — where a telescope points).
 * Jyotish software conventionally does not: JHora publishes **geometric** places,
 * with all three off. Measured against JHora's 1998 reference chart, the gap
 * between the two conventions is 44″ for Venus, 21″ for the Sun and 7″ for
 * Saturn — small, but far above the arcsecond level this engine works at, so it
 * has to be an explicit choice rather than an assumption.
 */
export interface PlaceCorrections {
    lightTime?:  boolean;
    deflection?: boolean;
    aberration?: boolean;
}

/** Geometric place: where the body *is*, ignoring how its light reaches us. */
export const GEOMETRIC: Required<PlaceCorrections> = {
    lightTime: false, deflection: false, aberration: false,
};

/** Apparent place: where the body is *seen*. Matches JPL Horizons. */
export const APPARENT: Required<PlaceCorrections> = {
    lightTime: true, deflection: true, aberration: true,
};

// ---------------------------------------------------------------------------
// Vector helpers (local, unrolled — these run in the hot path)
// ---------------------------------------------------------------------------

const dot  = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a: Vec): number => Math.hypot(a[0], a[1], a[2]);

function unit(a: Vec): Vec {
    const n = norm(a);
    return n === 0 ? [0, 0, 0] : [a[0] / n, a[1] / n, a[2] / n];
}

// ---------------------------------------------------------------------------
// Observer
// ---------------------------------------------------------------------------

/**
 * Barycentric state of the observer.
 *
 * @param geocentreOffset Optional observer offset from the geocentre in km
 *                        (ICRF equatorial) for topocentric places, plus its
 *                        velocity in km/s from Earth rotation.
 */
export function observerState(
    spk: BarycentricSource,
    earthNaifId: number,
    et: number,
    geocentreOffset?: { position: Vec; velocity: Vec },
): ObserverState {
    const e = spk.getBarycentric(earthNaifId, et);
    const position: Vec = [e.x, e.y, e.z];
    const velocity: Vec = [e.vx, e.vy, e.vz];

    if (geocentreOffset) {
        for (let i = 0; i < 3; i++) {
            position[i] += geocentreOffset.position[i];
            velocity[i] += geocentreOffset.velocity[i];
        }
    }
    return { position, velocity };
}

// ---------------------------------------------------------------------------
// Corrections
// ---------------------------------------------------------------------------

/**
 * Relativistic aberration (SOFA `iauAb`, deflection term handled separately).
 *
 * @param u  Geometric unit direction observer → body
 * @param v  Observer barycentric velocity in units of c
 */
function aberrate(u: Vec, v: Vec): Vec {
    const v2 = dot(v, v);
    const bm1 = Math.sqrt(Math.max(0, 1 - v2));   // 1/γ
    const pdv = dot(u, v);
    const w1  = 1 + pdv / (1 + bm1);

    return unit([
        u[0] * bm1 + w1 * v[0],
        u[1] * bm1 + w1 * v[1],
        u[2] * bm1 + w1 * v[2],
    ]);
}

/**
 * Gravitational deflection of light by the Sun
 * (Explanatory Supplement to the Astronomical Almanac, eq. 3.317-1).
 *
 * @param u  Unit direction observer → body
 * @param e  Sun → observer vector, km
 * @param q  Sun → body vector at emission, km
 */
function deflect(u: Vec, e: Vec, q: Vec): Vec {
    const eDist = norm(e);
    if (eDist === 0) return u;

    const eHat = unit(e);
    const qHat = unit(q);

    const g1 = SUN_2GM_C2 / eDist;
    const g2 = 1 + dot(qHat, eHat);
    if (g2 <= 1e-12) return u;   // body exactly behind the Sun — deflection undefined

    const uq = dot(u, qHat);
    const eu = dot(eHat, u);
    const k  = g1 / g2;

    return unit([
        u[0] + k * (uq * eHat[0] - eu * qHat[0]),
        u[1] + k * (uq * eHat[1] - eu * qHat[1]),
        u[2] + k * (uq * eHat[2] - eu * qHat[2]),
    ]);
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Geocentric (or topocentric) place of a solar-system body.
 *
 * @param spk         Barycentric state source (the loaded SPK file)
 * @param naifBody    NAIF id of the target
 * @param sunNaifId   NAIF id of the Sun (for the deflection geometry)
 * @param et          Ephemeris time, seconds past J2000.0 TDB
 * @param observer    Observer barycentric state at `et`
 * @param corrections Which corrections to apply; see {@link PlaceCorrections}
 */
export function computePlace(
    spk: BarycentricSource,
    naifBody: number,
    sunNaifId: number,
    et: number,
    observer: ObserverState,
    corrections: Required<PlaceCorrections> = APPARENT,
): ApparentPlace {
    // Deflection geometry degenerates for the Sun — it is the deflector.
    const wantDeflection = corrections.deflection && naifBody !== sunNaifId;

    // ── 1. Light-time: iterate to convergence (3 passes reaches < 1 µas) ────
    let tau = 0;
    let rel: Vec = [0, 0, 0];
    let bodyPos: Vec = [0, 0, 0];

    const passes = corrections.lightTime ? 3 : 1;
    for (let i = 0; i < passes; i++) {
        const b = spk.getBarycentric(naifBody, et - tau);
        bodyPos = [b.x, b.y, b.z];
        rel = [
            bodyPos[0] - observer.position[0],
            bodyPos[1] - observer.position[1],
            bodyPos[2] - observer.position[2],
        ];
        if (corrections.lightTime) tau = norm(rel) / C_KM_S;
    }

    const distanceKm = norm(rel);
    let dir = unit(rel);

    // ── 2. Gravitational deflection by the Sun ──────────────────────────────
    if (wantDeflection) {
        const sun = spk.getBarycentric(sunNaifId, et);
        const sunPos: Vec = [sun.x, sun.y, sun.z];
        const sunToObserver: Vec = [
            observer.position[0] - sunPos[0],
            observer.position[1] - sunPos[1],
            observer.position[2] - sunPos[2],
        ];
        const sunToBody: Vec = [
            bodyPos[0] - sunPos[0],
            bodyPos[1] - sunPos[1],
            bodyPos[2] - sunPos[2],
        ];
        dir = deflect(dir, sunToObserver, sunToBody);
    }

    // ── 3. Annual (+ diurnal, if topocentric) aberration ────────────────────
    if (corrections.aberration) {
        dir = aberrate(dir, [
            observer.velocity[0] / C_KM_S,
            observer.velocity[1] / C_KM_S,
            observer.velocity[2] / C_KM_S,
        ]);
    }

    return { direction: dir, distanceAU: distanceKm / AU_KM, lightTimeSec: tau };
}
