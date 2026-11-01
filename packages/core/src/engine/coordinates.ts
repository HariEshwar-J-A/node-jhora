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

import { assertCalendarMode, type CalendarMode, julianDayUt } from '../time/historical.js';
import { deltaT, getDeltaTContext, type PrecisionProfile } from './deltat.js';
import { gast06aDegrees } from './gst-erfa.js';
import { equationOfOriginsComplementaryDegrees } from './iers-eo-complementary.js';
import { julianDayUt1 } from './iers-eop.js';
import { nutation, nutationForProfile } from './nutation.js';
import {
    julianCenturies,
    matTransposeVec,
    matVec,
    meanObliquity,
    meanObliquityForProfile,
    precessionMatrix,
    rotateX,
    type Vec,
} from './precession.js';

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

/** Earth equatorial radius, km (WGS-84). */
const EARTH_A = 6378.137;
/** WGS-84 flattening. */
const EARTH_F = 1 / 298.257223563;
/** Earth rotation rate, rad/s (including precession in RA). */
const OMEGA_EARTH = 7.292115146706979e-5;

export { julianCenturies, meanObliquity };

/** Reduce an angle to [0, 360). */
export function mod360(x: number): number {
    return ((x % 360) + 360) % 360;
}

// ---------------------------------------------------------------------------
// Julian Day
// ---------------------------------------------------------------------------

/**
 * Julian Day (UT) from civil date/time. Default calendar `'auto'` matches JHora /
 * Swiss Ephemeris (Meeus ch. 7, reform at 1582-10-15).
 */
export function julday(
    year: number,
    month: number,
    day: number,
    hourUT: number,
    calendar: CalendarMode = 'auto',
): number {
    const h = Math.floor(hourUT);
    const remMin = (hourUT - h) * 60;
    const minute = Math.floor(remMin);
    const second = (remMin - minute) * 60;
    return julianDayUt(
        { astronomicalYear: year, month, day, hour: h, minute, second },
        assertCalendarMode(calendar),
    );
}

// ---------------------------------------------------------------------------
// Sidereal time
// ---------------------------------------------------------------------------

/**
 * Validity window of the IAU 2006 GMST polynomial (IERS Conventions 2010,
 * eq. 5.32; Capitaine, Wallace & Chapront 2005, A&A 432, 355), as JD (UT):
 * 1850-01-01 0h and 2050-01-01 0h. Outside this interval the long-term model
 * below (Vondrák precession + Simon et al. mean Earth longitude) is used,
 * joined with a constant offset at the nearer boundary (Capitaine et al.
 * 2003c; Vondrák, Capitaine & Wallace 2011).
 */
const IAU2006_SIDEREAL_FIRST_JD = 2396758.5;
const IAU2006_SIDEREAL_LAST_JD = 2469807.5;
/** TT Julian day bounds for IAU 2006 precession (1600–2200); truth GMST follows this span. */
const IAU2006_PRECESSION_JD_TT_MIN = 2305448.0;
const IAU2006_PRECESSION_JD_TT_MAX = 2524594.0;

function useGmstIAU2006(jdUT: number, profile: PrecisionProfile): boolean {
    if (profile === 'truth') {
        const jdTT = jdUT + deltaT(jdUT, profile) / 86400.0;
        return jdTT >= IAU2006_PRECESSION_JD_TT_MIN && jdTT <= IAU2006_PRECESSION_JD_TT_MAX;
    }
    return jdUT >= IAU2006_SIDEREAL_FIRST_JD && jdUT <= IAU2006_SIDEREAL_LAST_JD;
}

/**
 * IAU 2006 GMST (degrees): Earth Rotation Angle (IERS Conventions 2010 eq. 5.14;
 * ERFA `era00`, BSD-3) plus the accumulated precession in right ascension
 * (IERS 2010 eq. 5.32; ERFA `gmst06`) and Table 5.2e complementary terms.
 */
function gmstIAU2006(jdUT: number, dtSeconds: number = deltaT(jdUT)): number {
    const jdTT = jdUT + dtSeconds / 86400.0;
    const T = (jdTT - 2451545.0) / 36525.0;
    const jdrel = jdUT - 2451545.0;

    const era = mod360((0.779057273264 + (1 + 0.00273781191135448) * jdrel) * 360);

    const polyAs =
        0.014506 +
        4612.156534 * T +
        1.3915817 * T * T -
        0.00000044 * T ** 3 -
        0.000029956 * T ** 4 -
        0.0000000368 * T ** 5;
    return mod360(era + polyAs / 3600 + equationOfOriginsComplementaryDegrees(T));
}

/**
 * AU / c in days (light-time day fraction).
 */
const LIGHT_TIME_DAYS = 149597870700 / 299792458 / 86400;

/**
 * Long-term mean sidereal time (degrees) outside the IAU 2006 polynomial window.
 *
 * Mean geocentric longitude of the Earth–Moon barycentre (Simon et al. 1994,
 * A&A 282, 663, §5.8.3, p. 675) on the J2000 mean ecliptic, reduced by an
 * in-house light-time correction (~20.5″; see ADR 0019), precessed to the mean
 * equinox of date, then converted to right ascension; the UT day fraction is
 * added. Nutation enters in {@link getGAST}.
 */
function gmstLongTerm(jdUT: number, dtSeconds: number = deltaT(jdUT)): number {
    const jdTT = jdUT + dtSeconds / 86400.0;
    const t = (jdTT - 2451545.0) / 365250.0;
    const t2 = t * t;
    const t3 = t * t2;
    let meanEarthLonDeg =
        100.46645683 + (1295977422.83429 * t - 2.04411 * t2 - 0.00523 * t3) / 3600;
    meanEarthLonDeg = mod360(meanEarthLonDeg - (LIGHT_TIME_DAYS * 360) / 365.2425);

    const lam = meanEarthLonDeg * DEG;
    const oblJ2000 = meanObliquity(0, 2451545.0) * DEG;
    let v: Vec = [
        Math.cos(lam),
        Math.cos(oblJ2000) * Math.sin(lam),
        Math.sin(oblJ2000) * Math.sin(lam),
    ];

    const T = julianCenturies(jdTT);
    v = matVec(precessionMatrix(T, jdTT), v);
    v = rotateX(v, meanObliquity(T, jdTT));

    const raDeg = Math.atan2(v[1], v[0]) * RAD;
    const dayFraction = (((jdUT - 0.5) % 1) + 1) % 1;
    return mod360(raDeg + dayFraction * 360);
}

/**
 * Continuity constants, computed on first use at each boundary.
 *
 * They belong to the sidereal-time formulation, not to a ΔT prediction, so
 * they are always evaluated with the 'jhora' ΔT model (deltat.ts) at the
 * boundary instant, whatever profile or deltaTOverrideSeconds is in force.
 */
const longTermOffsets = new Map<number, number>();

/** Shortest signed angle a − b, degrees. */
function angleDiff(a: number, b: number): number {
    return mod360(a - b + 180) - 180;
}

/**
 * Greenwich Mean Sidereal Time in degrees.
 *
 * 1850–2050: IERS Conventions (2010) eq. 5.14 (ERA) and eq. 5.32 (GMST);
 * ERFA `era00` / `gmst06` (BSD-3). UTC is used in place of UT1; |UT1−UTC|
 * ≤ 0.9 s is a separate uncertainty (~14″).
 *
 * Outside 1850–2050 the IAU polynomial is not valid; the Simon et al. (1994)
 * long-term expression above is used, joined with a constant offset at the nearer
 * boundary (ADR 0019). That offset is computed from both formulas at the
 * boundary instant — it is not fitted to an oracle.
 */
export function getGMST(jdUT: number): number {
    if (jdUT > IAU2006_SIDEREAL_LAST_JD || jdUT < IAU2006_SIDEREAL_FIRST_JD) {
        const b =
            jdUT > IAU2006_SIDEREAL_LAST_JD ? IAU2006_SIDEREAL_LAST_JD : IAU2006_SIDEREAL_FIRST_JD;
        let offset = longTermOffsets.get(b);
        if (offset === undefined) {
            const dtB = deltaT(b, 'jhora');
            offset = angleDiff(gmstIAU2006(b, dtB), gmstLongTerm(b, dtB));
            longTermOffsets.set(b, offset);
        }
        return mod360(gmstLongTerm(jdUT) + offset);
    }
    return mod360(gmstIAU2006(jdUT));
}

/**
 * Greenwich Apparent Sidereal Time in degrees.
 *
 * Equation of the equinoxes Δψ cos ε_true (IERS Conventions 2010 eq. 5.16;
 * Wallace & Capitaine 2006). Complementary terms in Ω and 2Ω are already in
 * Table 5.2e via {@link equationOfOriginsComplementaryDegrees} inside {@link getGMST}.
 */
export function getGAST(
    jdUT: number,
    profile: PrecisionProfile = getDeltaTContext().profile,
): number {
    if (profile === 'truth' && useGmstIAU2006(jdUT, profile)) {
        const jdTT = jdUT + deltaT(jdUT) / 86400.0;
        const jdUt1 = julianDayUt1(jdUT, profile);
        return mod360(gast06aDegrees(jdUt1, jdTT));
    }
    const jdTT = jdUT + deltaT(jdUT) / 86400.0;
    const T = julianCenturies(jdTT);
    const { dpsi, deps } = nutationForProfile(T, profile);
    const epsTrue = meanObliquityForProfile(T, jdTT, profile) + deps;
    return mod360(getGMST(jdUT) + dpsi * Math.cos(epsTrue * DEG));
}

/** True obliquity of the ecliptic (mean + nutation in obliquity), degrees. */
export function trueObliquity(
    jdUT: number,
    profile: PrecisionProfile = getDeltaTContext().profile,
): number {
    const jdTT = jdUT + deltaT(jdUT) / 86400.0;
    const T = julianCenturies(jdTT);
    return meanObliquityForProfile(T, jdTT, profile) + nutationForProfile(T, profile).deps;
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
    jdUT: number,
    latDeg: number,
    lonDeg: number,
    altitudeM = 0,
): { position: Vec; velocity: Vec } {
    const lat = latDeg * DEG;
    const sinLat = Math.sin(lat),
        cosLat = Math.cos(lat);

    // Geodetic → geocentric (WGS-84 ellipsoid)
    const e2 = EARTH_F * (2 - EARTH_F);
    const C = 1 / Math.sqrt(1 - e2 * sinLat * sinLat);
    const S = C * (1 - e2);
    const h = altitudeM / 1000.0; // km

    const rCos = (EARTH_A * C + h) * cosLat; // distance from rotation axis, km
    const rSin = (EARTH_A * S + h) * sinLat; // distance from equatorial plane, km

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
    const jdTT = jdUT + deltaT(jdUT) / 86400.0;
    const T = julianCenturies(jdTT);
    const P = precessionMatrix(T, jdTT);

    return {
        position: matTransposeVec(P, posDate),
        velocity: matTransposeVec(P, velDate),
    };
}

// ---------------------------------------------------------------------------
// Ascendant, MC, house cusps
// ---------------------------------------------------------------------------

/**
 * Tropical Ascendant from RAMC and geographic latitude: the intersection of
 * the ecliptic with the eastern horizon.
 *
 * ASC = atan2( cos(RAMC),  −(sin ε · tan φ + cos ε · sin RAMC) )
 * (Meeus, *Astronomical Algorithms*, 2nd ed., ch. 14, longitude of the
 * ecliptic point on the horizon).
 *
 * The two-argument form resolves the quadrant to the *ascending* node of the
 * ecliptic on the horizon. Outside the polar circles that point is always in
 * the eastern half of the sky. Within them (|φ| > 90° − ε) the ecliptic can
 * rise in the west for part of each sidereal day; the ascendant is then
 * defined as the eastern intersection, which is the other root, 180° away
 * (Swiss Ephemeris general documentation §6.4 "House cusps beyond the polar
 * circle": "the ascendant is always in the eastern hemisphere"; the MC is
 * kept even when it lies below the horizon). The eastern half is where the
 * hour angle H = RAMC − α is negative.
 *
 * @param ramc  Right ascension of the midheaven, degrees
 * @param lat   Geographic latitude, degrees
 * @param eps   Obliquity of the ecliptic, degrees
 */
export function computeAscendant(ramc: number, lat: number, eps: number): number {
    const R = ramc * DEG;
    const E = eps * DEG;

    // Near the poles the Meeus ascendant formula is singular. Clamp to ±(90° − ε)
    // with ε small enough that the equatorial Vertex limit (co-latitude → ±90°)
    // matches Swiss Ephemeris / JHora to sub-arcsecond (see computeVertex).
    const POLE_CLAMP_DEG = 89.999999;
    const L = Math.max(-POLE_CLAMP_DEG, Math.min(POLE_CLAMP_DEG, lat)) * DEG;

    const asc = mod360(
        Math.atan2(Math.cos(R), -(Math.sin(E) * Math.tan(L) + Math.cos(E) * Math.sin(R))) * RAD,
    );
    if (Math.abs(lat) <= 90 - eps) return asc;

    const [ra] = eclipticToEquatorial(asc, 0, eps);
    return Math.sin((ramc - ra) * DEG) > 0 ? mod360(asc + 180) : asc;
}

/** Tropical Midheaven from RAMC. */
export function computeMC(ramc: number, eps: number): number {
    const R = ramc * DEG;
    const E = eps * DEG;
    return mod360(Math.atan2(Math.sin(R), Math.cos(R) * Math.cos(E)) * RAD);
}

/** Ecliptic (λ, β) to equatorial (RA, dec), degrees. */
function eclipticToEquatorial(lon: number, beta: number, eps: number): [number, number] {
    const L = lon * DEG;
    const B = beta * DEG;
    const E = eps * DEG;
    const dec =
        Math.asin(Math.sin(B) * Math.cos(E) + Math.cos(B) * Math.sin(E) * Math.sin(L)) * RAD;
    const ra = Math.atan2(Math.sin(L) * Math.cos(E) - Math.tan(B) * Math.sin(E), Math.cos(L)) * RAD;
    return [mod360(ra), dec];
}

/**
 * Azimuth measured from south, increasing toward the west (90° = west).
 * Matches the convention Swiss Ephemeris uses when selecting the vertex.
 */
function azimuthFromSouth(ra: number, dec: number, ramc: number, lat: number): number {
    let H = (ramc - ra) * DEG;
    if (H > Math.PI) H -= 2 * Math.PI;
    if (H < -Math.PI) H += 2 * Math.PI;
    const phi = lat * DEG;
    const d = dec * DEG;
    const y = Math.sin(H);
    const x = Math.cos(H) * Math.sin(phi) - Math.tan(d) * Math.cos(phi);
    return mod360(Math.atan2(y, x) * RAD + 180);
}

/**
 * Tropical Vertex — western intersection of the ecliptic with the prime
 * vertical (`ascmc[3]`). The southern co-latitude ascendant gives one
 * intersection; the other is 180° away. Keep the point whose azimuth is west.
 *
 * At φ = 0 the co-latitude is exactly ±90° (a geographic pole), which is a
 * removable singularity of the ascendant formula. {@link computeAscendant} uses
 * a tight pole clamp (89.999999°) so the φ → 0 limit matches SE/JHora rather
 * than the older 89.9999° clamp that left ~0.9″ error at the equator.
 */
export function computeVertex(ramc: number, lat: number, eps: number): number {
    const southColatAsLat = lat >= 0 ? lat - 90 : lat + 90;
    const v0 = mod360(computeAscendant(ramc, southColatAsLat, eps));
    const v1 = mod360(v0 + 180);
    const westOf = (lon: number): number => {
        const [ra, dec] = eclipticToEquatorial(lon, 0, eps);
        const az = azimuthFromSouth(ra, dec, ramc, lat);
        const d = Math.abs(az - 270);
        return d > 180 ? 360 - d : d;
    };
    return westOf(v0) <= westOf(v1) ? v0 : v1;
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

/** Ecliptic arc from `from` forward to `to`, in (0, 360]. */
function forwardArc(from: number, to: number): number {
    const d = mod360(to - from);
    return d === 0 ? 360 : d;
}

/**
 * Porphyry cusps: trisect the ecliptic arcs MC→Asc and Asc→IC, and place the
 * opposite cusps 180° away.
 *
 * Swiss Ephemeris general documentation §6.2 describes Porphyry as one of the
 * quadrant systems; the trisection is the classical definition (Munkasey,
 * *An Astrological House Formulary*, 1991). Checked against `swe_houses_ex`
 * to < 0.001″.
 */
export function porphyryCusps(asc: number, mc: number): number[] {
    const ic = mod360(mc + 180);
    const at = (from: number, to: number, f: number) => mod360(from + forwardArc(from, to) * f);
    const c11 = at(mc, asc, 1 / 3);
    const c12 = at(mc, asc, 2 / 3);
    const c2 = at(asc, ic, 1 / 3);
    const c3 = at(asc, ic, 2 / 3);
    return [
        asc,
        c2,
        c3,
        ic,
        mod360(c11 + 180),
        mod360(c12 + 180),
        mod360(asc + 180),
        mod360(c2 + 180),
        mod360(c3 + 180),
        mc,
        c11,
        c12,
    ];
}

/**
 * Stopping tolerance on Placidus right ascension α (radians) for the
 * `'converged'` scheme. 1e-13 rad ≈ 2.1e-11° ≪ 0.01″ (houses evidence brief).
 */
export const PLACIDUS_CONVERGED_TOL_RAD = 1e-13;

/** Iteration cap for `'converged'` Placidus (contraction rate &lt; 2/3 below the polar circle). */
export const PLACIDUS_CONVERGED_MAX_ITER = 96;

/** Bisection refinement steps if the fixed-point loop stalls (defensive). */
const PLACIDUS_BISECT_STEPS = 64;

/** Ecliptic longitude λ for a point on the ecliptic with right ascension α (degrees). */
function eclipticLongitudeFromRa(alphaRad: number, eps: number): number {
    const cosE = Math.cos(eps * DEG);
    return mod360(Math.atan2(Math.sin(alphaRad), Math.cos(alphaRad) * cosE) * RAD);
}

/**
 * Placidus cusp right ascension α (radians) by fixed-point iteration.
 *
 * Unified form (Holden 1977; classical spherical trigonometry; see
 * docs/derivations/houses.md): with `t = tan φ · tan ε`, `|t| &lt; 1`,
 *
 *   α = θ + c + g · SDA(α),   SDA(α) = acos(−t · sin α).
 *
 * Cusps 11, 12, 2, 3 use `(c, g)` = `(0, 1/3)`, `(0, 2/3)`, `(π/3, 2/3)`,
 * `(2π/3, 1/3)` respectively; `θ` is RAMC in radians.
 */
function placidusAlphaRad(thetaRad: number, cRad: number, g: number, tanProduct: number): number {
    const base = thetaRad + cRad;
    const sda = (alpha: number): number => {
        const arg = Math.max(-1, Math.min(1, -tanProduct * Math.sin(alpha)));
        return Math.acos(arg);
    };

    let alpha = base + g * (Math.PI / 2);
    for (let i = 0; i < PLACIDUS_CONVERGED_MAX_ITER; i++) {
        const next = base + g * sda(alpha);
        const step = next - alpha;
        alpha = next;
        if (Math.abs(step) < PLACIDUS_CONVERGED_TOL_RAD) return alpha;
    }

    // Defensive bisection on F(α) = α − base − g·SDA(α) ∈ [base, base + gπ].
    let lo = base;
    let hi = base + g * Math.PI;
    for (let i = 0; i < PLACIDUS_BISECT_STEPS; i++) {
        const mid = 0.5 * (lo + hi);
        if (mid - base - g * sda(mid) < 0) lo = mid;
        else hi = mid;
    }
    return 0.5 * (lo + hi);
}

/** Fully converged Placidus ecliptic longitude; undefined at |tan φ tan ε| ≥ 1. */
export function placidusLongitudeConverged(
    ramc: number,
    lat: number,
    eps: number,
    cRad: number,
    g: number,
): number {
    const latR = Math.max(-89.999, Math.min(89.999, lat)) * DEG;
    const tanProduct = Math.tan(latR) * Math.tan(eps * DEG);
    const alpha = placidusAlphaRad(ramc * DEG, cRad, g, tanProduct);
    return eclipticLongitudeFromRa(alpha, eps);
}

/**
 * How the Placidus cusps are solved.
 *
 * • `'jhora'` (default) reproduces Jagannatha Hora's bundled Swiss Ephemeris
 *   2.02.01 DLL (`swedll32.dll`), which does not iterate to convergence. Its
 *   behaviour was identified clean-room, treating the DLL as a black box
 *   (`tools/jhora-dll-golden`, probe of ~6 000 cusps over |φ| ≤ 66.5°,
 *   ε 23–24°, all sidereal times) and fitting it to the published
 *   pole (“Placidian pole”) form of the semi-arc method:
 *
 *     AD    = asin(tan φ · tan δ)                       ascensional difference
 *     tan P = sin(f · AD) / tan δ                       pole of the cusp circle
 *     λ     = atan2(sin H, cos H · cos ε − tan P · sin ε),  H = RAMC + offset
 *
 *   (offset 30/60/120/150°, f = 1/3, 2/3, 2/3, 1/3 for cusps 11, 12, 2, 3;
 *   Munkasey, *An Astrological House Formulary*, 1991; Holden, *The
 *   Elements of House Division*, 1977). Observed behaviour: the first pole
 *   is taken from the solstitial declination δ₀ = ε, then three pole
 *   refinements follow, each using δ of the previous λ. That reproduces every
 *   probed DLL cusp to < 3e-9″ (its 12-decimal print precision). The
 *   truncation error vs the exact cusp is 0 below ~25°, ~1e-4″ at 40°,
 *   ~0.01″ at 50°, ~0.5″ at 55°, ~70″ at 60° and ~2000″ near 65°.
 * • `'converged'` solves the classical fixed point
 *   `α = RAMC + c + g·acos(−tan φ tan ε · sin α)` to {@link PLACIDUS_CONVERGED_TOL_RAD}
 *   radians on α (pyswisseph / SE 2.10). Below ~30° latitude this agrees with
 *   `'jhora'` to &lt; 0.001″; near 66° the two oracles differ by up to ~26″ on
 *   some cusps because SE 2.02 stops after three pole refinements.
 */
export type PlacidusScheme = 'jhora' | 'converged';

/** Pole refinements after the δ₀ = ε start in the 'jhora' scheme (observed). */
export const JHORA_PLACIDUS_REFINEMENTS = 3;

/** Placidus cusp by the pole form, truncated as JHora's DLL does. */
function placidusLongitudePole(
    ramc: number,
    lat: number,
    eps: number,
    offset: number,
    fraction: number,
    refinements: number,
): number {
    const E = eps * DEG;
    const sinE = Math.sin(E);
    const cosE = Math.cos(E);
    const tanPhi = Math.tan(lat * DEG);
    const H = (ramc + offset) * DEG;
    const sinH = Math.sin(H);
    const cosH = Math.cos(H);

    const poleTan = (dec: number): number => {
        const td = Math.tan(dec);
        // δ → 0: sin(f·AD)/tan δ → f·tan φ.
        if (Math.abs(td) < 1e-15) return fraction * tanPhi;
        const ad = Math.asin(Math.max(-1, Math.min(1, tanPhi * td)));
        return Math.sin(fraction * ad) / td;
    };
    const cusp = (tanP: number): number =>
        mod360(Math.atan2(sinH, cosH * cosE - tanP * sinE) * RAD);

    let lam = cusp(poleTan(E));
    for (let i = 0; i < refinements; i++) {
        lam = cusp(poleTan(Math.asin(sinE * Math.sin(lam * DEG))));
    }
    return lam;
}

/**
 * Placidus cusps from RAMC, geographic latitude and the obliquity used for the
 * ascendant. Houses 5, 6, 8 and 9 are the opposites of 11, 12, 2 and 3.
 *
 * @param scheme  'jhora' (default, JHora DLL truncation) or 'converged'.
 */
export function placidusCusps(
    ramc: number,
    lat: number,
    eps: number,
    asc: number,
    mc: number,
    scheme: PlacidusScheme = 'jhora',
): number[] {
    // Cusp n sits (n − 10)·30° of RA past the MC; Placidus trisects the
    // semi-arc, so its fraction is that RA offset over the 90° quadrant.
    const pole = (house: number) => {
        const off = 30 * ((house + 2) % 12);
        const f = (off <= 90 ? off : 180 - off) / 90;
        return placidusLongitudePole(ramc, lat, eps, off, f, JHORA_PLACIDUS_REFINEMENTS);
    };
    const [c11, c12, c2, c3] =
        scheme === 'jhora'
            ? [11, 12, 2, 3].map(pole)
            : [
                  placidusLongitudeConverged(ramc, lat, eps, 0, 1 / 3),
                  placidusLongitudeConverged(ramc, lat, eps, 0, 2 / 3),
                  placidusLongitudeConverged(ramc, lat, eps, Math.PI / 3, 2 / 3),
                  placidusLongitudeConverged(ramc, lat, eps, (2 * Math.PI) / 3, 1 / 3),
              ];
    return [
        asc,
        c2,
        c3,
        mod360(mc + 180),
        mod360(c11 + 180),
        mod360(c12 + 180),
        mod360(asc + 180),
        mod360(c2 + 180),
        mod360(c3 + 180),
        mc,
        c11,
        c12,
    ];
}
