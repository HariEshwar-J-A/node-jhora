/**
 * Fundamental arguments F_1…F_14 for IAU 2006/2000A nutation and EO series.
 *
 * IERS Conventions (2010), Technical Note 36, eq. (5.43) (Delaunay and Ω) and
 * eq. (5.44) (planetary mean longitudes and general precession p_A), with t
 * in Julian centuries of TT.
 */

const TWO_PI = 2 * Math.PI;
const DEG = Math.PI / 180;

function wrapRadians(x: number): number {
    let a = x % TWO_PI;
    if (a < 0) a += TWO_PI;
    return a;
}

/** F_1…F_14 at TT Julian centuries t since J2000.0; values in radians. */
export function fundamentalArgumentsIers2010Radians(tCenturies: number): number[] {
    // Eq. (5.43): l, l′, F, D, Ω — degrees with arcsecond-per-century rates.
    const f1 = (134.96340251 + (1717915923.2178 * tCenturies) / 3600) * DEG;
    const f2 = (357.52910918 + (129596581.0481 * tCenturies) / 3600) * DEG;
    const f3 = (93.27209062 + (1739527262.8478 * tCenturies) / 3600) * DEG;
    const f4 = (297.85019547 + (1602961601.209 * tCenturies) / 3600) * DEG;
    const f5 = (125.04455501 + (-6962890.5431 * tCenturies) / 3600) * DEG;

    // Eq. (5.44): planetary means and p_A — already in radians.
    const f6 = 4.402608842 + 2608.7903141574 * tCenturies;
    const f7 = 3.176146697 + 1021.3285546211 * tCenturies;
    const f8 = 1.753470314 + 628.3075849991 * tCenturies;
    const f9 = 6.203480913 + 334.06124267 * tCenturies;
    const f10 = 0.599546497 + 52.9690962641 * tCenturies;
    const f11 = 0.874016757 + 21.329910496 * tCenturies;
    const f12 = 5.481293871 + 7.4781598567 * tCenturies;
    const f13 = 5.321159 + 3.8127774 * tCenturies;
    const f14 = (0.02438175 + 0.00000538691 * tCenturies) * tCenturies;

    return [
        wrapRadians(f1),
        wrapRadians(f2),
        wrapRadians(f3),
        wrapRadians(f4),
        wrapRadians(f5),
        wrapRadians(f6),
        wrapRadians(f7),
        wrapRadians(f8),
        wrapRadians(f9),
        wrapRadians(f10),
        wrapRadians(f11),
        wrapRadians(f12),
        wrapRadians(f13),
        f14,
    ];
}
