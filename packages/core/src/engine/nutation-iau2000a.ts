/**
 * IAU 2000A nutation (MHB2000, Mathews et al. 2002) with the IAU 2006
 * adjustment (IERS Conventions 2010 §5.6.3, ERFA nut06a).
 *
 * Series coefficients transcribed from ERFA nut00a (BSD-3) into
 * `nutation-iau2000a.data.json` via `tools/generate-nutation-iau2000a-data.mjs`.
 * Delaunay Ω follows ERFA faom03 / Simon et al. 1994.
 */

import { ASTRO_SERIES_NUTATION_IAU2000A, getActiveAstroSeriesCache } from './astro-series-cache.js';
import { fundamentalArgumentsIers2010Radians } from './iers-fundamental-arguments.js';
import type { Nutation } from './nutation.js';
import data from './nutation-iau2000a.data.json' with { type: 'json' };

const TWO_PI = 2 * Math.PI;
const TURNAS = 1296000;
const DAS2R = Math.PI / (180 * 3600);
const U2R = DAS2R / 1e7;

function wrapRadians(x: number): number {
    let a = x % TWO_PI;
    if (a < 0) a += TWO_PI;
    return a;
}

/** MHB2000 / IERS 2003 Delaunay arguments for the luni-solar series (radians). */
function mhbLuniSolarArguments(t: number): [number, number, number, number, number] {
    const el = wrapRadians(
        ((485868.249036 + t * (1717915923.2178 + t * (31.8792 + t * (0.051635 - 0.0002447 * t)))) /
            TURNAS) *
            TWO_PI,
    );
    const elp = wrapRadians(
        ((1287104.79305 + t * (129596581.0481 + t * (-0.5532 + t * (0.000136 - 0.00001149 * t)))) /
            TURNAS) *
            TWO_PI,
    );
    const f = wrapRadians(
        ((335779.526232 +
            t * (1739527262.8478 + t * (-12.7512 + t * (-0.001037 + 0.00000417 * t)))) /
            TURNAS) *
            TWO_PI,
    );
    const d = wrapRadians(
        ((1072260.70369 + t * (1602961601.209 + t * (-6.3706 + t * (0.006593 - 0.00003169 * t)))) /
            TURNAS) *
            TWO_PI,
    );
    const om = wrapRadians(
        ((450160.398036 + t * (-6962890.5431 + t * (7.4722 + t * (0.007702 - 0.00005939 * t)))) /
            TURNAS) *
            TWO_PI,
    );
    return [el, elp, f, d, om];
}

/** Planetary nutation fundamental arguments (radians). */
function mhbPlanetaryArguments(t: number): number[] {
    const f = fundamentalArgumentsIers2010Radians(t);
    const al = wrapRadians(2.35555598 + 8328.6914269554 * t);
    const af = wrapRadians(1.627905234 + 8433.466158131 * t);
    const ad = wrapRadians(5.198466741 + 7771.3771468121 * t);
    const aom = wrapRadians(2.1824392 - 33.757045 * t);
    const alne = wrapRadians(5.321159 + 3.8127774 * t);
    return [al, af, ad, aom, f[5], f[6], f[7], f[8], f[9], f[10], f[11], alne, f[13]];
}

function nutationIau2000aExact(T: number): Nutation {
    const t = T;
    const [el, elp, f, d, om] = mhbLuniSolarArguments(t);
    let dp = 0;
    let de = 0;

    for (const term of data.luniSolar) {
        const [nl, nlp, nf, nd, nom] = term.m;
        const arg = wrapRadians(nl * el + nlp * elp + nf * f + nd * d + nom * om);
        const s = Math.sin(arg);
        const c = Math.cos(arg);
        dp += (term.sp + term.spt * t) * s + term.cp * c;
        de += (term.ce + term.cet * t) * c + term.se * s;
    }

    const pargs = mhbPlanetaryArguments(t);
    for (const term of data.planetary) {
        const m = term.m;
        let arg = 0;
        for (let j = 0; j < m.length; j++) arg += m[j]! * pargs[j]!;
        arg = wrapRadians(arg);
        const s = Math.sin(arg);
        const c = Math.cos(arg);
        dp += term.sp * s + term.cp * c;
        de += term.se * s + term.ce * c;
    }

    // IERS 2010 §5.6.3 / ERFA nut06a: scale nut00a for IAU 2006 precession frame.
    const fj2 = -2.7774e-6 * t;
    dp *= 1 + 0.4697e-6 + fj2;
    de *= 1 + fj2;

    const rad2deg = 180 / Math.PI;
    return { dpsi: dp * U2R * rad2deg, deps: de * U2R * rad2deg };
}

/**
 * Nutation in longitude and obliquity (degrees) at Julian centuries T (TT).
 * Uses the active {@link AstroSeriesCache} on the engine call stack when bound.
 */
export function nutationIau2000a(T: number): Nutation {
    const cache = getActiveAstroSeriesCache();
    if (!cache) {
        return nutationIau2000aExact(T);
    }
    return cache.get(ASTRO_SERIES_NUTATION_IAU2000A, T, () => nutationIau2000aExact(T));
}
