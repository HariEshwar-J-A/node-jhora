/**
 * precession.ts — IAU 2006 precession and mean obliquity.
 *
 * The previous implementation approximated precession by *adding* the scalar
 * general-precession-in-longitude ψ_A to a J2000 ecliptic longitude. That is
 * not the transformation: the ecliptic pole itself moves, so the mapping is a
 * rotation, not a translation, and the scalar shortcut leaves a latitude-
 * dependent error that grows with distance from J2000.
 *
 * Here the transformation is done properly:
 *   ICRF equatorial  --P(t)-->  mean equator & equinox of date  --R1(ε_A)-->
 *   mean ecliptic & equinox of date
 *
 * Angles: Capitaine et al. (2003), adopted as IAU 2006. The constant terms in
 * ζ_A and z_A carry the ICRS→J2000 frame-bias rotation in right ascension; the
 * two residual bias components (ξ₀, η₀ ≈ 17 mas) are neglected, which is two
 * orders of magnitude below this engine's 1″ target.
 */

const DEG = Math.PI / 180;
const AS2R = Math.PI / (180 * 3600);   // arcseconds → radians

export type Vec = [number, number, number];
export type Mat = [Vec, Vec, Vec];

/** Julian centuries (TT) from J2000.0. */
export function julianCenturies(jd: number): number {
    return (jd - 2451545.0) / 36525.0;
}

/**
 * Mean obliquity of the ecliptic (degrees), IAU 2006.
 *
 * ε_A = 84381.406″ − 46.836769″T − 0.0001831″T² + 0.00200340″T³
 *                  − 0.000000576″T⁴ − 0.0000000434″T⁵
 */
export function meanObliquity(T: number): number {
    const eps = 84381.406
              - 46.836769   * T
              -  0.0001831  * T ** 2
              +  0.00200340 * T ** 3
              -  0.000000576 * T ** 4
              -  0.0000000434 * T ** 5;
    return eps / 3600.0;
}

/**
 * Equatorial precession angles ζ_A, z_A, θ_A (radians) for ICRF → mean equator
 * and equinox of date. IAU 2006 (Capitaine et al. 2003).
 */
function precessionAngles(T: number): { zeta: number; z: number; theta: number } {
    const zeta =  2.650545
               + 2306.083227   * T
               +    0.2988499  * T ** 2
               +    0.01801828 * T ** 3
               -    0.000005971 * T ** 4
               -    0.0000003173 * T ** 5;

    const z    = -2.650545
               + 2306.077181   * T
               +    1.0927348  * T ** 2
               +    0.01826837 * T ** 3
               -    0.000028596 * T ** 4
               -    0.0000002904 * T ** 5;

    const theta = 2004.191903  * T
                -    0.4294934 * T ** 2
                -    0.04182264 * T ** 3
                -    0.000007089 * T ** 4
                -    0.0000001274 * T ** 5;

    return { zeta: zeta * AS2R, z: z * AS2R, theta: theta * AS2R };
}

/**
 * Precession matrix P such that  v_meanEquatorOfDate = P · v_ICRF.
 *
 * P = R3(−z_A) · R2(θ_A) · R3(−ζ_A)
 */
export function precessionMatrix(T: number): Mat {
    const { zeta, z, theta } = precessionAngles(T);

    const cz = Math.cos(zeta),  sz = Math.sin(zeta);
    const ct = Math.cos(theta), st = Math.sin(theta);
    const cZ = Math.cos(z),     sZ = Math.sin(z);

    return [
        [ cz * ct * cZ - sz * sZ,  -sz * ct * cZ - cz * sZ,  -st * cZ ],
        [ cz * ct * sZ + sz * cZ,  -sz * ct * sZ + cz * cZ,  -st * sZ ],
        [ cz * st,                 -sz * st,                  ct      ],
    ];
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

/** Apply the transpose of `m` — for a rotation matrix this is the inverse. */
export function matTransposeVec(m: Mat, v: Vec): Vec {
    return [
        m[0][0] * v[0] + m[1][0] * v[1] + m[2][0] * v[2],
        m[0][1] * v[0] + m[1][1] * v[1] + m[2][1] * v[2],
        m[0][2] * v[0] + m[1][2] * v[1] + m[2][2] * v[2],
    ];
}

/** Rotate about the x-axis by `angleDeg` (equatorial → ecliptic uses +ε). */
export function rotateX(v: Vec, angleDeg: number): Vec {
    const a = angleDeg * DEG;
    const c = Math.cos(a), s = Math.sin(a);
    return [v[0], v[1] * c + v[2] * s, -v[1] * s + v[2] * c];
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
 */
export function icrfToMeanEclipticOfDate(v: Vec, T: number): Vec {
    return rotateX(matVec(precessionMatrix(T), v), meanObliquity(T));
}

/**
 * Inverse of {@link icrfToMeanEclipticOfDate}: mean ecliptic of date → ICRF.
 */
export function meanEclipticOfDateToIcrf(v: Vec, T: number): Vec {
    return matTransposeVec(precessionMatrix(T), rotateX(v, -meanObliquity(T)));
}
