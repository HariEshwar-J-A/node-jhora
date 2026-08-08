/**
 * coordinates.ts — Julian day, sidereal time, angles and house cusps.
 *
 * Frame transforms (precession, obliquity) now live in `precession.ts`, and the
 * apparent-place chain (light-time, aberration, deflection) in `apparent.ts`.
 * What remains here is the Earth-rotation side of the problem: sidereal time,
 * the ascendant/MC, house cusps, and the observer's geocentric vector.
 *
 * All angles are in degrees unless documented otherwise.
 */

import { nutation }                                from './nutation.js';
import { deltaT }                                  from './deltat.js';
import { meanObliquity, julianCenturies, rotateX,
         matTransposeVec, precessionMatrix,
         type Vec }                                from './precession.js';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/** Earth equatorial radius, km (WGS-84). */
const EARTH_A = 6378.137;
/** WGS-84 flattening. */
const EARTH_F = 1 / 298.257223563;
/** Earth rotation rate, rad/s (including precession in RA). */
const OMEGA_EARTH = 7.292115146706979e-5;

export { meanObliquity, julianCenturies };

/** Reduce an angle to [0, 360). */
export function mod360(x: number): number {
    return ((x % 360) + 360) % 360;
}

// ---------------------------------------------------------------------------
// Julian Day
// ---------------------------------------------------------------------------

/**
 * Julian Day Number (UT) from a UTC calendar date (Meeus §7, Gregorian).
 */
export function julday(year: number, month: number, day: number, hourUT: number): number {
    let y = year;
    let m = month;
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    return Math.floor(365.25 * (y + 4716)) +
           Math.floor(30.6001 * (m + 1)) +
           day + hourUT / 24.0 + B - 1524.5;
}

// ---------------------------------------------------------------------------
// Sidereal time
// ---------------------------------------------------------------------------

/**
 * Greenwich Mean Sidereal Time in degrees, IAU 1982 (Aoki et al.).
 *
 * UTC is used in place of UT1. |UT1 − UTC| ≤ 0.9 s, which is ~13″ of Earth
 * rotation — the dominant uncertainty in the ascendant. Swiss Ephemeris (and
 * therefore JHora) makes the same substitution, so this matches rather than
 * diverges from the reference.
 */
export function getGMST(jdUT: number): number {
    const jd0 = Math.floor(jdUT - 0.5) + 0.5;      // preceding midnight
    const H   = (jdUT - jd0) * 24.0;               // hours past 0h UT
    const Tu  = (jd0 - 2451545.0) / 36525.0;

    // GMST at 0h UT, seconds of time
    const gmst0 = 24110.54841
                + 8640184.812866 * Tu
                +       0.093104 * Tu ** 2
                -       6.2e-6   * Tu ** 3;

    // Advance by elapsed UT, scaled to the sidereal rate
    const gmstHours = gmst0 / 3600.0 + H * 1.00273790935;
    return mod360(gmstHours * 15.0);
}

/**
 * Greenwich Apparent Sidereal Time in degrees: GMST plus the equation of the
 * equinoxes (Δψ · cos ε_true).
 */
export function getGAST(jdUT: number): number {
    const T = julianCenturies(jdUT + deltaT(jdUT) / 86400.0);
    const { dpsi, deps } = nutation(T);
    const epsTrue = meanObliquity(T) + deps;
    return mod360(getGMST(jdUT) + dpsi * Math.cos(epsTrue * DEG));
}

/** True obliquity of the ecliptic (mean + nutation in obliquity), degrees. */
export function trueObliquity(jdUT: number): number {
    const T = julianCenturies(jdUT + deltaT(jdUT) / 86400.0);
    return meanObliquity(T) + nutation(T).deps;
}

// ---------------------------------------------------------------------------
// Observer geocentric vector (topocentric places)
// ---------------------------------------------------------------------------

/**
 * Observer position and velocity relative to the geocentre, expressed as an
 * ICRF equatorial vector in km and km/s.
 *
 * This replaces the previous ad-hoc lunar-parallax formula. Adding the true
 * observer vector to Earth's barycentric state means light-time, aberration
 * (including the diurnal component) and parallax all fall out of the same
 * apparent-place chain instead of being patched on afterwards.
 *
 * @param jdUT      Julian Day, UT
 * @param latDeg    Geodetic latitude, degrees
 * @param lonDeg    Geographic longitude, degrees east
 * @param altitudeM Height above the ellipsoid, metres
 */
export function observerGeocentricVector(
    jdUT: number, latDeg: number, lonDeg: number, altitudeM = 0,
): { position: Vec; velocity: Vec } {
    const lat = latDeg * DEG;
    const sinLat = Math.sin(lat), cosLat = Math.cos(lat);

    // Geodetic → geocentric (WGS-84 ellipsoid)
    const e2 = EARTH_F * (2 - EARTH_F);
    const C  = 1 / Math.sqrt(1 - e2 * sinLat * sinLat);
    const S  = C * (1 - e2);
    const h  = altitudeM / 1000.0;   // km

    const rCos = (EARTH_A * C + h) * cosLat;   // distance from rotation axis, km
    const rSin = (EARTH_A * S + h) * sinLat;   // distance from equatorial plane, km

    // Local apparent sidereal time gives the position in the true equator of date
    const last = mod360(getGAST(jdUT) + lonDeg) * DEG;

    const posDate: Vec = [rCos * Math.cos(last), rCos * Math.sin(last), rSin];
    const velDate: Vec = [
        -OMEGA_EARTH * rCos * Math.sin(last),
         OMEGA_EARTH * rCos * Math.cos(last),
         0,
    ];

    // True equator of date → ICRF. Nutation is a sub-arcsecond rotation of the
    // observer vector (< 1 m of position), so only precession is undone.
    const T = julianCenturies(jdUT + deltaT(jdUT) / 86400.0);
    const P = precessionMatrix(T);

    return {
        position: matTransposeVec(P, posDate),
        velocity: matTransposeVec(P, velDate),
    };
}

// ---------------------------------------------------------------------------
// Ascendant, MC, house cusps
// ---------------------------------------------------------------------------

/**
 * Tropical Ascendant from RAMC and geographic latitude.
 *
 * ASC = atan2( cos(RAMC),  −(sin ε · tan φ + cos ε · sin RAMC) )
 *
 * The two-argument form resolves the quadrant directly. A single-argument
 * atan collapses the result into ±90° and needs sign patching that fails for
 * roughly half the zodiac — the source of the historical 180° ascendant bug.
 *
 * @param ramc  Right ascension of the midheaven, degrees
 * @param lat   Geographic latitude, degrees
 * @param eps   Obliquity of the ecliptic, degrees
 */
export function computeAscendant(ramc: number, lat: number, eps: number): number {
    const R = ramc * DEG;
    const E = eps  * DEG;

    // Clamp latitude away from the poles, where the ascendant is undefined.
    const L = Math.max(-89.9999, Math.min(89.9999, lat)) * DEG;

    return mod360(
        Math.atan2(
            Math.cos(R),
            -(Math.sin(E) * Math.tan(L) + Math.cos(E) * Math.sin(R)),
        ) * RAD,
    );
}

/** Tropical Midheaven from RAMC. */
export function computeMC(ramc: number, eps: number): number {
    const R = ramc * DEG;
    const E = eps  * DEG;
    return mod360(Math.atan2(Math.sin(R), Math.cos(R) * Math.cos(E)) * RAD);
}

/**
 * Tropical Vertex — the ecliptic point on the prime vertical due west.
 * Equivalent to the ascendant computed for the co-latitude, half a turn away.
 */
export function computeVertex(ramc: number, lat: number, eps: number): number {
    const coLat = (lat >= 0 ? 90 - lat : -90 - lat);
    return mod360(computeAscendant(mod360(ramc + 180), coLat, eps) + 180);
}

/**
 * Whole-Sign house cusps from the sidereal ascendant: house 1 begins at 0° of
 * the sign holding the ascendant, and each subsequent house is the next sign.
 */
export function wholeSignCusps(ascSidereal: number): number[] {
    const h1Start = Math.floor(mod360(ascSidereal) / 30) * 30;
    return Array.from({ length: 12 }, (_, i) => mod360(h1Start + i * 30));
}

/**
 * Equal-house cusps: 30° arcs measured from the exact ascendant degree.
 */
export function equalHouseCusps(ascSidereal: number): number[] {
    return Array.from({ length: 12 }, (_, i) => mod360(ascSidereal + i * 30));
}
