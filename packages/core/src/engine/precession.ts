/**
 * precession.ts — long-term precession and mean obliquity (Vondrák et al. 2011).
 *
 * Vondrák, Capitaine & Wallace (2011), A&A 534, A22, with the 2012 erratum
 * (Q_A periodic term C7 = 198.296701″). Coefficients match ERFA `eraLtp*`
 * (SOFA, BSD) and the published tables; the precession matrix follows
 * Appendix A.3 (`ltp_PMAT`, Fabri parameterization from the ecliptic and
 * equator poles) for reference, and §5.5 eq. (24)–(28) (`P_Σ`) for the
 * equator-only matrix used in chart transforms (O4: mean ecliptic = equator of
 * date tilted by ε_A, not the Table 1 ecliptic pole).
 *
 * Both `'jhora'` and `'modern'` profiles use this model at all epochs (see
 * docs/precision-profiles.md). The `'truth'` profile uses IAU 2006 inside
 * 1600–2200 TT with Vondrák mean ecliptic outside that window. Near J2000 Vondrák agrees with IAU
 * 2006 P03 to ~0.1 mas (Vondrák et al. 2011, §4).
 */

import { icrfToMeanEclipticOfDateForProfile } from '../truth/mean-ecliptic-iau2006.js';
import {
    ASTRO_SERIES_VONDRAK_MEAN_OBLIQUITY,
    ASTRO_SERIES_VONDRAK_PRECESSION_MATRIX,
    getActiveAstroSeriesCache,
} from './astro-series-cache.js';
import type { PrecisionProfile } from './deltat.js';
import { nutationIau2000a } from './nutation-iau2000a.js';

export { icrfToMeanEclipticOfDateForProfile };

const DEG = Math.PI / 180;
const AS2R = Math.PI / (180 * 3600);
const EPS0_RAD = 84381.406 * AS2R;

export type Vec = [number, number, number];
export type Mat = [Vec, Vec, Vec];

/** Julian centuries (TT) from J2000.0. */
export function julianCenturies(jd: number): number {
    return (jd - 2451545.0) / 36525.0;
}

// ---------------------------------------------------------------------------
// Vondrák 2011 — Table 1 (P_A, Q_A), erratum C7
// ---------------------------------------------------------------------------

const PQ_POL: readonly (readonly [number, number])[] = [
    [5851.607687, -1600.8863],
    [-0.1189, 1.1689818],
    [-0.00028913, -2e-7],
    [1.01e-7, -4.37e-7],
];

const PQ_PER: readonly (readonly [number, number, number, number, number])[] = [
    [708.15, -5486.751211, -684.66156, 667.66673, -5523.863691],
    [2309.0, -17.127623, 2446.28388, -2354.886252, -549.74745],
    [1620.0, -617.517403, 399.671049, -428.152441, -310.998056],
    [492.2, 413.44294, -356.652376, 376.202861, 421.535876],
    [1183.0, 78.614193, -186.387003, 184.778874, -36.776172],
    [622.0, -180.732815, -316.80007, 335.321713, -145.278396],
    [882.0, -87.676083, 198.296701, -185.138669, -34.74445],
    [547.0, 46.140315, 101.135679, -120.97283, 22.885731],
];

// Table 2 (X_A, Y_A)
const XY_POL: readonly (readonly [number, number])[] = [
    [5453.282155, -73750.93035],
    [0.4252841, -0.7675452],
    [-0.00037173, -0.00018725],
    [-1.52e-7, 2.31e-7],
];

const XY_PER: readonly (readonly [number, number, number, number, number])[] = [
    [256.75, -819.940624, 75004.344875, 81491.287984, 1558.515853],
    [708.15, -8444.676815, 624.033993, 787.163481, 7774.939698],
    [274.2, 2600.009459, 1251.136893, 1251.296102, -2219.534038],
    [241.45, 2755.17563, -1102.212834, -1257.950837, -2523.969396],
    [2309.0, -167.659835, -2660.66498, -2966.79973, 247.850422],
    [492.2, 871.855056, 699.291817, 639.744522, -846.485643],
    [396.1, 44.769698, 153.16722, 131.600209, -1393.124055],
    [288.9, -512.313065, -950.865637, -445.040117, 368.526116],
    [231.1, -819.415595, 499.754645, 584.522874, 749.045012],
    [1610.0, -538.071099, -145.18821, -89.756563, 444.704518],
    [620.0, -189.793622, 558.116553, 524.42963, 235.934465],
    [157.87, -402.922932, -23.923029, -13.549067, 374.049623],
    [220.3, 179.516345, -165.405086, -210.157124, -171.33018],
    [1200.0, -9.814756, 9.344131, -44.919798, -22.899655],
];

// Table 3 (p_A, ε_A)
const PE_POL: readonly (readonly [number, number])[] = [
    [8134.017132, 84028.206305],
    [5043.0520035, 0.3624445],
    [-0.00710733, -0.00004039],
    [2.71e-7, -1.1e-7],
];

const PE_PER: readonly (readonly [number, number, number, number, number])[] = [
    [409.9, -6908.287473, 753.87278, -2845.175469, -1704.720302],
    [396.15, -3198.706291, -247.805823, 449.844989, -862.308358],
    [537.22, 1453.674527, 379.471484, -1255.915323, 447.832178],
    [402.9, -857.748557, -53.880558, 886.736783, -889.571909],
    [417.15, 1173.231614, -90.109153, 418.887514, 190.402846],
    [288.92, -156.981465, -353.60019, 997.912441, -56.564991],
    [4043.0, 371.83655, -63.115353, -240.97971, -296.222622],
    [306.0, -216.61904, -28.248187, 76.541307, -75.859952],
    [277.0, 193.691479, 17.703387, -36.788069, 67.473503],
    [203.0, 11.891524, 38.911307, -170.964086, 3.014055],
];

function vondrakPeriodic(
    T: number,
    periodics: readonly (readonly [number, number, number, number, number])[],
    poly: readonly (readonly [number, number])[],
    sinCos?: Map<number, [number, number]>,
): [number, number] {
    const w = 2 * Math.PI * T;
    let a = 0;
    let b = 0;
    for (const [p, c1, s1, c2, s2] of periodics) {
        let cs = sinCos?.get(p);
        if (!cs) {
            const ang = w / p;
            cs = [Math.cos(ang), Math.sin(ang)];
            sinCos?.set(p, cs);
        }
        const c = cs[0]!;
        const s = cs[1]!;
        a += c * c1 + s * c2;
        b += c * s1 + s * s2;
    }
    let wp = 1;
    for (const [pa, pb] of poly) {
        a += pa * wp;
        b += pb * wp;
        wp *= T;
    }
    return [a, b];
}

function vondrakLtecmPoles(T: number): { p: Vec; z: Vec } {
    const sinCos = new Map<number, [number, number]>();
    const [pAs, qAs] = vondrakPeriodic(T, PQ_PER, PQ_POL, sinCos);
    const [xAs, yAs] = vondrakPeriodic(T, XY_PER, XY_POL, sinCos);
    const pArc = pAs * AS2R;
    const qArc = qAs * AS2R;
    const zLen = Math.sqrt(Math.max(0, 1 - pArc * pArc - qArc * qArc));
    const sEps = Math.sin(EPS0_RAD);
    const cEps = Math.cos(EPS0_RAD);
    const z: Vec = [pArc, -qArc * cEps - zLen * sEps, -qArc * sEps + zLen * cEps];
    const xArc = xAs * AS2R;
    const yArc = yAs * AS2R;
    const w = xArc * xArc + yArc * yArc;
    const pz = w < 1 ? Math.sqrt(1 - w) : 0;
    const p: Vec = [xArc, yArc, pz];
    return { p, z };
}

/** Ecliptic pole unit vector, J2000 mean equator and equinox (Vondrák eq. 8). */
function vondrakEclipticPole(T: number): Vec {
    const [pAs, qAs] = vondrakPeriodic(T, PQ_PER, PQ_POL);
    const p = pAs * AS2R;
    const q = qAs * AS2R;
    const z = Math.sqrt(Math.max(0, 1 - p * p - q * q));
    const s = Math.sin(EPS0_RAD);
    const c = Math.cos(EPS0_RAD);
    return [p, -q * c - z * s, -q * s + z * c];
}

/** Mean equator pole unit vector (Vondrák eq. 9). */
function vondrakEquatorPole(T: number): Vec {
    const [xAs, yAs] = vondrakPeriodic(T, XY_PER, XY_POL);
    const x = xAs * AS2R;
    const y = yAs * AS2R;
    const w = x * x + y * y;
    const z = w < 1 ? Math.sqrt(1 - w) : 0;
    return [x, y, z];
}

function cross(a: Vec, b: Vec): Vec {
    return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function normalize(v: Vec): Vec {
    const n = Math.hypot(v[0], v[1], v[2]);
    if (n === 0) return [0, 0, 1];
    return [v[0] / n, v[1] / n, v[2] / n];
}

/** Precession matrix J2000 mean equator → mean equator of date (Vondrák A.3). */
function vondrakPrecessionMatrixExact(T: number): Mat {
    const peqr = vondrakEquatorPole(T);
    const pecl = vondrakEclipticPole(T);
    const eqx = normalize(cross(peqr, pecl));
    const mid = cross(peqr, eqx);
    return [eqx, mid, peqr];
}

export function vondrakPrecessionMatrix(T: number): Mat {
    const cache = getActiveAstroSeriesCache();
    if (!cache) {
        return vondrakPrecessionMatrixExact(T);
    }
    return cache.get(ASTRO_SERIES_VONDRAK_PRECESSION_MATRIX, T, () =>
        vondrakPrecessionMatrixExact(T),
    );
}

/**
 * Equator-only precession matrix P_Σ (Vondrák et al. 2011 §5.5, eq. 24–28).
 * Rows are the Σ unit vector, n̄ × Σ, and the mean equator pole n̄ from Table 2.
 */
export function vondrakEquatorPrecessionMatrixSigma(T: number): Mat {
    const [xAs, yAs] = vondrakPeriodic(T, XY_PER, XY_POL);
    const x = xAs * AS2R;
    const y = yAs * AS2R;
    const w = x * x + y * y;
    const z = w < 1 ? Math.sqrt(1 - w) : 0;
    const a = 1 / (1 + z);
    const n: Vec = [x, y, z];
    const vSigma = normalize([1 - a * x * x, -a * x * y, -x]);
    const yAxis = normalize(cross(n, vSigma));
    return [vSigma, yAxis, n];
}

/** Mean obliquity ε_A (degrees), Vondrák eq. (10). */
function vondrakMeanObliquityDegreesExact(T: number): number {
    const [, epsAs] = vondrakPeriodic(T, PE_PER, PE_POL);
    return epsAs / 3600;
}

export function vondrakMeanObliquityDegrees(T: number): number {
    const cache = getActiveAstroSeriesCache();
    if (!cache) {
        return vondrakMeanObliquityDegreesExact(T);
    }
    return cache.get(ASTRO_SERIES_VONDRAK_MEAN_OBLIQUITY, T, () =>
        vondrakMeanObliquityDegreesExact(T),
    );
}

/** TT Julian day bounds for IAU 2006 mean ecliptic (Capitaine et al. 2005). */
export const TRUTH_IAU2006_JD_TT_MIN = 2305448.0;
export const TRUTH_IAU2006_JD_TT_MAX = 2524594.0;

export function truthUsesIau2006MeanEcliptic(jdTT: number): boolean {
    return jdTT >= TRUTH_IAU2006_JD_TT_MIN && jdTT <= TRUTH_IAU2006_JD_TT_MAX;
}

/**
 * Obliquity between the Vondrák mean equator and ecliptic poles (Tables 1–2),
 * equivalent to the angle used with ERFA `eraLtecm` (Vondrák et al. 2011, BSD ERFA).
 */
export function vondrakPoleObliquityDegrees(T: number): number {
    const pecl = vondrakEclipticPole(T);
    const peqr = vondrakEquatorPole(T);
    const dot = pecl[0] * peqr[0] + pecl[1] * peqr[1] + pecl[2] * peqr[2];
    return Math.acos(Math.max(-1, Math.min(1, dot))) / DEG;
}

/** ICRS → mean ecliptic rotation (ERFA `eraLtecm`; BSD ERFA / SOFA). */
export function vondrakLtecmMatrix(T: number): Mat {
    const p = vondrakEquatorPole(T);
    const z = vondrakEclipticPole(T);
    const wRaw = cross(p, z);
    const wLen = Math.hypot(wRaw[0], wRaw[1], wRaw[2]);
    const x: Vec = wLen === 0 ? [1, 0, 0] : [wRaw[0] / wLen, wRaw[1] / wLen, wRaw[2] / wLen];
    const y = cross(z, x);
    const dr = -0.0146 * AS2R;
    const dx = -0.016617 * AS2R;
    const de = -0.0068192 * AS2R;
    const row = (u: Vec): Vec => [
        u[0] - u[1] * dr + u[2] * dx,
        u[0] * dr + u[1] + u[2] * de,
        -u[0] * dx - u[1] * de + u[2],
    ];
    return [row(x), row(y), row(z)];
}

/** Row-major 3×3 ICRS → mean ecliptic rotation (same as {@link vondrakLtecmMatrix}). */
export function vondrakLtecmMatrixInto(T: number, out: Float64Array): void {
    const { p, z } = vondrakLtecmPoles(T);
    const wRaw = cross(p, z);
    const wLen = Math.hypot(wRaw[0], wRaw[1], wRaw[2]);
    const x0 = wLen === 0 ? 1 : wRaw[0] / wLen;
    const x1 = wLen === 0 ? 0 : wRaw[1] / wLen;
    const x2 = wLen === 0 ? 0 : wRaw[2] / wLen;
    const y0 = z[1] * x2 - z[2] * x1;
    const y1 = z[2] * x0 - z[0] * x2;
    const y2 = z[0] * x1 - z[1] * x0;
    const dr = -0.0146 * AS2R;
    const dx = -0.016617 * AS2R;
    const de = -0.0068192 * AS2R;
    out[0] = x0 - x1 * dr + x2 * dx;
    out[1] = x0 * dr + x1 + x2 * de;
    out[2] = -x0 * dx - x1 * de + x2;
    out[3] = y0 - y1 * dr + y2 * dx;
    out[4] = y0 * dr + y1 + y2 * de;
    out[5] = -y0 * dx - y1 * de + y2;
    out[6] = z[0] - z[1] * dr + z[2] * dx;
    out[7] = z[0] * dr + z[1] + z[2] * de;
    out[8] = -z[0] * dx - z[1] * de + z[2];
}

/** Apply {@link vondrakLtecmMatrixInto} to `(x,y,z)` without allocating a matrix. */
export function vondrakLtecmMatVec(T: number, x: number, y: number, z: number): Vec {
    const m = vondrakScratch9;
    vondrakLtecmMatrixInto(T, m);
    return [
        m[0]! * x + m[1]! * y + m[2]! * z,
        m[3]! * x + m[4]! * y + m[5]! * z,
        m[6]! * x + m[7]! * y + m[8]! * z,
    ];
}

const vondrakScratch9 = new Float64Array(9);

/**
 * ICRF → mean ecliptic and equinox of date on the Vondrák two-pole frame
 * (ERFA `eraLtecm`; not the O4 R₁(ε_A)·P chart frame).
 */
export function icrfToVondrakTwoPoleMeanEcliptic(v: Vec, T: number): Vec {
    return matVec(vondrakLtecmMatrix(T), v);
}

/** Mean obliquity for house geometry and sidereal transforms. */
export function meanObliquityForProfile(
    T: number,
    jdTT: number,
    profile: PrecisionProfile,
): number {
    if (profile === 'truth' && !truthUsesIau2006MeanEcliptic(jdTT)) {
        return vondrakPoleObliquityDegrees(T);
    }
    return meanObliquity(T, jdTT);
}

/**
 * IAU 2006 / Vondrák Table 3 general precession in longitude p_A (arcseconds),
 * Julian centuries TT from J2000.0. Added to J2000 ecliptic longitudes for
 * referral to the mean equinox of date near the DE440s span.
 */
export function generalPrecessionLongitudeArcsec(T: number): number {
    const [pAs] = vondrakPeriodic(T, PE_PER, PE_POL);
    return pAs;
}

/**
 * Mean obliquity of the ecliptic (degrees), Vondrák ε_A (eq. 10).
 */
export function meanObliquity(T: number, _jdTT?: number): number {
    return vondrakMeanObliquityDegrees(T);
}

/**
 * Precession matrix P such that v_meanEquatorOfDate = P · v_ICRF (J2000 mean).
 */
export function precessionMatrix(T: number, _jdTT?: number): Mat {
    return vondrakPrecessionMatrix(T);
}

// ---------------------------------------------------------------------------
// Small vector/matrix helpers
// ---------------------------------------------------------------------------

export function matVec(m: Mat, v: Vec): Vec {
    return [
        m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
        m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
        m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
    ];
}

export function matTransposeVec(m: Mat, v: Vec): Vec {
    return [
        m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2],
        m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2],
        m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2],
    ];
}

/** Rotate about the x-axis by `angleDeg` (equatorial → ecliptic uses +ε). R₁. */
export function rotateX(v: Vec, angleDeg: number): Vec {
    const a = angleDeg * DEG;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [v[0], v[1] * c + v[2] * s, -v[1] * s + v[2] * c];
}

/** Rotate about the y-axis by `angleDeg`. R₂. */
export function rotateY(v: Vec, angleDeg: number): Vec {
    const a = angleDeg * DEG;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [v[0] * c - v[2] * s, v[1], v[0] * s + v[2] * c];
}

/** Rotate about the z-axis by `angleDeg`. R₃. */
export function rotateZ(v: Vec, angleDeg: number): Vec {
    const a = angleDeg * DEG;
    const c = Math.cos(a);
    const s = Math.sin(a);
    return [v[0] * c + v[1] * s, -v[0] * s + v[1] * c, v[2]];
}

/**
 * IAU 2000 frame bias: GCRS → mean dynamical equator and equinox of J2000.0.
 *
 * IERS Conventions (2010), §5.4.5 and §5.9: the separate frame-bias
 * rotation in the equinox-based product N×P×B (SOFA BI00). TN36
 * numbers the angles, not that product:
 *   B = R₁(−η₀) R₂(ξ₀) R₃(dα₀)
 *   dα₀ = −14.6 mas (eq. 5.21); ξ₀ = −16.6170 mas, η₀ = −6.8192 mas (eq. 5.33).
 * Eq. (5.16) is the CIP X, Y series and eq. (5.32) is GMST.
 *
 * These are the published angles, not a fitted offset. Chart ecliptic
 * longitudes stay on the ICRF; {@link chartEclipticFromIcrfDirection}
 * applies B only for latitude. The horizon place applies B to the whole
 * vector because that is the equator the rise/set oracle matches (ADR 0009).
 */
const FRAME_BIAS_DALPHA0_DEG = -0.0146 / 3600;
const FRAME_BIAS_XI0_DEG = -0.016617 / 3600;
const FRAME_BIAS_ETA0_DEG = -0.0068192 / 3600;

export function iau2000FrameBias(v: Vec): Vec {
    return rotateX(
        rotateY(rotateZ(v, FRAME_BIAS_DALPHA0_DEG), FRAME_BIAS_XI0_DEG),
        -FRAME_BIAS_ETA0_DEG,
    );
}

/**
 * TRUEPOS chart ecliptic from an ICRF direction: longitude on the ICRF
 * equator, latitude after the IAU 2000 frame bias (oracle default).
 */
export function chartEclipticFromIcrfDirection(
    v: Vec,
    T: number,
    jdTT?: number,
    profile: PrecisionProfile = 'jhora',
): { lon: number; lat: number } {
    const jd = jdTT ?? 2451545.0 + T * 36525.0;
    const toEcl = (vec: Vec) =>
        toSpherical(icrfToMeanEclipticOfDateForProfile(vec, T, jd, profile));
    let lon = toEcl(v).lon;
    const lat = toSpherical(
        icrfToMeanEclipticOfDateForProfile(
            profile === 'truth' ? v : iau2000FrameBias(v),
            T,
            jd,
            profile,
        ),
    ).lat;
    if (profile === 'truth') {
        lon = mod360(lon + nutationIau2000a(T).dpsi);
    }
    return { lon, lat };
}

const mod360 = (x: number): number => ((x % 360) + 360) % 360;

/** Spherical (degrees) → cartesian. Longitude is from x toward y; latitude toward z. */
export function fromSpherical(lonDeg: number, latDeg: number, r = 1): Vec {
    const lon = lonDeg * DEG;
    const lat = latDeg * DEG;
    const cl = Math.cos(lat);
    return [r * cl * Math.cos(lon), r * cl * Math.sin(lon), r * Math.sin(lat)];
}

/** Cartesian → spherical. Returns longitude/latitude in degrees, radius in input units. */
export function toSpherical(v: Vec): { lon: number; lat: number; r: number } {
    const r = Math.hypot(v[0], v[1], v[2]);
    const lon = Math.atan2(v[1], v[0]) / DEG;
    const lat = r === 0 ? 0 : Math.asin(v[2] / r) / DEG;
    return { lon: ((lon % 360) + 360) % 360, lat, r };
}

/**
 * Transform an ICRF equatorial vector to the **mean** ecliptic and equinox of
 * date — the frame in which sidereal longitudes and ayanamsa are defined.
 *
 * Oracle O4 (precession brief): mean ecliptic of date = mean equator of date
 * (Table 2 / {@link vondrakPrecessionMatrix}) inclined by ε_A (eq. 10), i.e.
 * R₁(ε_A)·P_fabri·v. This is not the Table 1 ecliptic-pole series. §5.5 P_Σ
 * ({@link vondrakEquatorPrecessionMatrixSigma}) is the CIO equator matrix only;
 * its Σ axis is not the sidereal equinox used for chart longitudes.
 */
export function icrfToMeanEclipticOfDate(v: Vec, T: number, jdTT?: number): Vec {
    const jd = jdTT ?? 2451545.0 + T * 36525.0;
    return rotateX(matVec(precessionMatrix(T, jd), v), meanObliquity(T, jd));
}

/**
 * Inverse of {@link icrfToMeanEclipticOfDate}: mean ecliptic of date → ICRF.
 */
export function meanEclipticOfDateToIcrf(v: Vec, T: number, jdTT?: number): Vec {
    const jd = jdTT ?? 2451545.0 + T * 36525.0;
    return matTransposeVec(precessionMatrix(T, jd), rotateX(v, -meanObliquity(T, jd)));
}
