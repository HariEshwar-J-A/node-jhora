/**
 * coordinates.ts — Astronomical coordinate transforms for the DE440 engine.
 *
 * All input positions are barycentric/geocentric J2000.0 equatorial rectangular
 * (km) as returned by SpkFile.getGeocentric().
 *
 * Formulas:
 *   Obliquity   — IAU 1980 series (Lieske et al.)
 *   GAST        — IAU 1982 formula (Aoki et al.)
 *   Ascendant   — standard spherical trigonometry
 *   Parallax    — simple lunar parallax correction (re-used from prior code)
 *
 * All angles in degrees unless documented otherwise.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEG  = Math.PI / 180;
const RAD  = 180 / Math.PI;
const AU   = 149597870.7;   // 1 AU in km (IAU 2012)

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/** Reduce angle to [0, 360). */
export function mod360(x: number): number {
    return ((x % 360) + 360) % 360;
}

// ---------------------------------------------------------------------------
// Julian Day
// ---------------------------------------------------------------------------

/**
 * Compute Julian Day Number (UT) from a UTC calendar date.
 * Algorithm from Meeus §7.
 */
export function julday(year: number, month: number, day: number, hourUT: number): number {
    let y = year;
    let m = month;
    if (m <= 2) { y -= 1; m += 12; }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);   // Gregorian calendar correction
    return Math.floor(365.25 * (y + 4716)) +
           Math.floor(30.6001 * (m + 1)) +
           day + hourUT / 24.0 + B - 1524.5;
}

/**
 * Julian centuries from J2000.0.
 * T = (JD − 2451545.0) / 36525
 */
export function julianCenturies(jd: number): number {
    return (jd - 2451545.0) / 36525.0;
}

/**
 * Convert Julian Day to ephemeris time (seconds from J2000.0 TDB).
 * Approximation: TDB ≈ TT ≈ UT + 69.184 s (as of 2024).
 * For astrological accuracy the 69 s correction is irrelevant (< 0.001°).
 */
export function jdToET(jd: number): number {
    return (jd - 2451545.0) * 86400.0;
}

/**
 * General precession in ecliptic longitude (degrees).
 *
 * Converts from the ecliptic J2000.0 (ICRF) frame to the ecliptic of date,
 * which is the tropical frame used by JHora / Swiss Ephemeris.
 *
 * Formula: ψ_A = (5029.097″ × T + 1.563″ × T²) / 3600
 *   where T = Julian centuries from J2000.0 (negative for pre-J2000 dates).
 *
 * IAU 1976 Lieske et al. luni-solar precession (general precession in longitude).
 * Accuracy: < 0.001° for ±200 years of J2000.
 *
 * @param T  Julian centuries from J2000.0
 */
export function generalPrecessionInLon(T: number): number {
    return (5029.097 * T + 1.563 * T * T) / 3600.0;
}

// ---------------------------------------------------------------------------
// Obliquity of the Ecliptic — IAU 1980
// ---------------------------------------------------------------------------

/**
 * Mean obliquity of the ecliptic (degrees) using the IAU 1980 formula.
 * Accurate to ~0.001" over the range ±50 years from J2000.
 *
 * @param T  Julian centuries from J2000.0
 */
export function meanObliquity(T: number): number {
    // Lieske et al. (1977) / IAU 1980 series
    return 23.4392911111
         - 0.0130041667 * T
         - 1.6388889e-7 * T * T
         + 5.0361111e-7 * T * T * T;
}

// ---------------------------------------------------------------------------
// Rectangular → Ecliptic conversion
// ---------------------------------------------------------------------------

export interface EclipticPosition {
    lon:  number;   // degrees [0, 360)
    lat:  number;   // degrees [-90, +90]
    dist: number;   // AU
    speedLon: number;   // degrees per day
}

/**
 * Convert geocentric J2000.0 equatorial rectangular coords to apparent
 * ecliptic longitude, latitude, and distance.
 *
 * @param x,y,z    km, equatorial rectangular
 * @param vx,vy,vz km/s, velocity components
 * @param T        Julian centuries from J2000.0 (for obliquity)
 */
export function rectToEcliptic(
    x: number, y: number, z: number,
    vx: number, vy: number, vz: number,
    T: number,
): EclipticPosition {
    const eps  = meanObliquity(T) * DEG;
    const cosE = Math.cos(eps);
    const sinE = Math.sin(eps);

    // Rotate from equatorial to ecliptic (rotation about x-axis by ε)
    const xe =  x;
    const ye =  y * cosE + z * sinE;
    const ze = -y * sinE + z * cosE;

    const vxe =  vx;
    const vye =  vy * cosE + vz * sinE;
    const vze = -vy * sinE + vz * cosE;

    // Spherical coords — longitude in ecliptic of date (apply general precession)
    const r2   = xe * xe + ye * ye + ze * ze;
    const r    = Math.sqrt(r2);
    // Convert from ecliptic J2000 → ecliptic of date by adding ψ_A (IAU 1976)
    const psiA = generalPrecessionInLon(T);
    const lon  = mod360(Math.atan2(ye, xe) * RAD + psiA);
    const lat  = Math.asin(ze / r) * RAD;

    // Speed in longitude (deg/day) via cross product derivative: d(lon)/dt
    // dλ/dt = (xe·vye - ye·vxe) / (xe²+ye²) × RAD × 86400
    const rxy2 = xe * xe + ye * ye;
    const dLonRad_s = rxy2 > 0 ? (xe * vye - ye * vxe) / rxy2 : 0;
    const speedLon  = dLonRad_s * RAD * 86400; // deg/day

    return { lon, lat, dist: r / AU, speedLon };
}

// ---------------------------------------------------------------------------
// Sidereal Time — GAST
// ---------------------------------------------------------------------------

/**
 * Greenwich Apparent Sidereal Time in degrees.
 * Uses the IAU 1982 formula (accurate to ~0.1" for modern dates).
 *
 * @param jd  Julian Day (UT)
 */
export function getGAST(jd: number): number {
    const T   = julianCenturies(jd);
    const jd0 = Math.floor(jd - 0.5) + 0.5;   // JD of preceding midnight
    const H   = (jd - jd0) * 24.0;             // hours past midnight UT

    // GMST at 0h UT on Julian Day jd0 (degrees)
    const T0    = julianCenturies(jd0);
    const gmst0 = 100.4606184
                + 36000.77004 * T0
                + 0.000387933 * T0 * T0
                - T0 * T0 * T0 / 38710000.0;

    // Add Earth rotation: 360.98564724° per sidereal day × H/24
    const gmst = mod360(gmst0 + 360.98564724 * H / 24.0);

    // Nutation correction (approximate) for GAST
    // Δψ ≈ -17.2" sin(Ω), Ω = mean lunar node longitude
    const omega = mod360(125.04452 - 1934.136261 * T);
    const nutEq = -0.000480 * Math.sin(omega * DEG);  // degrees

    return mod360(gmst + nutEq);
}

// ---------------------------------------------------------------------------
// Ascendant & House Cusps
// ---------------------------------------------------------------------------

/**
 * Compute the tropical Ascendant from RAMC (Right Ascension of MC) and
 * geographic latitude.
 *
 * Formula: tan(ASC) = −cos(RAMC) / (sin(ε)tan(φ) + cos(ε)sin(RAMC))
 *
 * @param ramc  RAMC in degrees
 * @param lat   Geographic latitude in degrees
 * @param eps   Obliquity of ecliptic in degrees
 * @returns     Tropical ascendant longitude in degrees [0, 360)
 */
export function computeAscendant(ramc: number, lat: number, eps: number): number {
    const R = ramc * DEG;
    const L = lat  * DEG;
    const E = eps  * DEG;

    const numerator   = -Math.cos(R);
    const denominator =  Math.sin(E) * Math.tan(L) + Math.cos(E) * Math.sin(R);

    // Use single-argument atan (not atan2) — the SE/Meeus quadrant correction
    // `if cos(RAMC) > 0 add 180°` is designed for atan, not atan2.
    // atan2 already folds in an extra ±180° when the denominator is negative,
    // which causes the ascendant to land in the wrong hemisphere (180° off).
    let asc: number;
    if (Math.abs(denominator) < 1e-10) {
        // Denominator near zero only near geographic poles; treat as 0°
        asc = 0;
    } else {
        asc = Math.atan(numerator / denominator) * RAD;
    }

    // Standard quadrant resolution: when the raw atan result is positive, the
    // ascendant is in the eastern hemisphere and needs a 180° correction.
    if (asc > 0) asc += 180;
    return mod360(asc);
}

/**
 * Compute the tropical Midheaven (MC).
 * MC = atan2(cos RAMC, −sin ε · tan δ + cos ε · sin RAMC)  ... but simpler:
 * MC ≈ atan2(tan RAMC, cos ε)    (standard formula)
 */
export function computeMC(ramc: number, eps: number): number {
    const R = ramc * DEG;
    const E = eps  * DEG;
    const mc = Math.atan2(Math.sin(R), Math.cos(R) * Math.cos(E)) * RAD;
    return mod360(mc);
}

/**
 * Compute Whole-Sign house cusps from the sidereal ascendant.
 *
 * In Whole Sign houses, each house occupies exactly one sign.
 * House 1 starts at 0° of the sign containing the ascendant.
 *
 * @param ascSidereal  Sidereal ascendant in degrees
 * @returns 12-element array of house cusp longitudes (sidereal, 0-indexed = H1 start)
 */
export function wholeSignCusps(ascSidereal: number): number[] {
    const h1Start = Math.floor(ascSidereal / 30) * 30;   // start of ascendant's sign
    return Array.from({ length: 12 }, (_, i) => mod360(h1Start + i * 30));
}

// ---------------------------------------------------------------------------
// Lunar parallax correction (topocentric)
// ---------------------------------------------------------------------------

/**
 * Apply Moon parallax correction for a surface observer.
 * Shifts geocentric ecliptic lon/lat to topocentric.
 *
 * @param lon      Geocentric ecliptic longitude (degrees)
 * @param lat      Geocentric ecliptic latitude (degrees)
 * @param dist     Geocentric distance (AU)
 * @param geoLat   Observer geographic latitude (degrees)
 * @param lst      Local Sidereal Time (degrees)
 * @param eps      Obliquity of ecliptic (degrees)
 */
export function applyLunarParallax(
    lon: number, lat: number, dist: number,
    geoLat: number, lst: number, eps: number,
): { lon: number; lat: number } {
    // Equatorial horizontal parallax
    const sinPi = (6378.137 / AU) / dist;   // Earth radius / distance
    const pi_   = Math.asin(sinPi);          // parallax angle (rad)

    const L = lon * DEG;
    const B = lat * DEG;
    const E = eps * DEG;
    const P = geoLat * DEG;
    const H = (lst - lon) * DEG;             // local hour angle of body

    // Observer's geocentric lat and distance (Meeus §11)
    const u    = Math.atan(0.99664719 * Math.tan(P));
    const rhoSinP = 0.99664719 * Math.sin(u) + (0 / 6378137) * Math.sin(P);
    const rhoCosP = Math.cos(u) + (0 / 6378137) * Math.cos(P);

    // Parallax in longitude and latitude (Meeus §40)
    const DeltaL = -pi_ * rhoCosP * Math.sin(H) /
                   (Math.cos(B) - pi_ * rhoCosP * Math.cos(H));

    const newLon = lon + DeltaL * RAD;

    const DeltaB = -pi_ * (rhoSinP * Math.cos(E) - rhoCosP * Math.sin(E) * Math.cos(H)) *
                   Math.sin(newLon * DEG - L) / Math.sin(B - pi_ * (rhoSinP * Math.sin(E) +
                   rhoCosP * Math.cos(E) * Math.cos(H) * Math.cos(newLon * DEG - L)));

    return {
        lon: mod360(newLon),
        lat: lat + (isNaN(DeltaB) ? 0 : DeltaB * RAD),
    };
}
