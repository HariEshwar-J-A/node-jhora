/**
 * ayanamsa.ts — Sidereal zero-point models (Drik Siddhanta).
 *
 * Two families of ayanamsa live here, and the distinction matters:
 *
 *   • **Star-defined ("true") ayanamsas** — the zero point is fixed by putting a
 *     named star at an exact sidereal longitude. True Chitrapaksha is the
 *     canonical case: Chitra (Spica, α Virginis) sits at exactly 180°00′00″.
 *     These need no fitted constants at all. The ayanamsa is *derived* from the
 *     star's computed position, so it is exact by construction at every date
 *     and tracks the real sky (Drik / observational siddhanta).
 *
 *   • **Epoch-defined ayanamsas** — the zero point is fixed by declaring a value
 *     at a reference epoch (Lahiri, Raman, KP, Fagan/Bradley …). These need an
 *     (epoch, value) anchor and are then propagated by precession.
 *
 * ── What changed and why ─────────────────────────────────────────────────────
 * The previous version modelled *every* ayanamsa as a J2000 constant plus the
 * scalar polynomial ψ_A = 5029.0966″T + 1.1120″T². Two problems:
 *
 *   1. Precession of the sidereal zero point is a rotation of the ecliptic
 *      frame, not a scalar added to a longitude. The shortcut drifts.
 *   2. The J2000 constants were back-fitted so that one chart reproduced one
 *      expected Moon longitude. Any error elsewhere in the engine (and there
 *      was 7–41″ of it) got absorbed into those constants, then re-emitted at
 *      every other date.
 *
 * Both families are now propagated with the exact IAU 2006 precession rotation
 * from `precession.ts`, and the true-star family carries no fitted constant.
 */

import { deltaT } from './deltat.js';
import {
    julianCenturies,
    precessionMatrix,
    matTransposeVec,
    icrfToMeanEclipticOfDate,
    toSpherical,
    type Vec,
} from './precession.js';
import { AU_KM } from './apparent.js';

const DEG = Math.PI / 180;
const MAS_TO_RAD = Math.PI / (180 * 3600 * 1000);
const PC_IN_AU   = 206264.806247;
/** km/s → AU/Julian year. */
const KMS_TO_AU_YR = 86400 * 365.25 / AU_KM;

const mod360 = (x: number): number => ((x % 360) + 360) % 360;

// ---------------------------------------------------------------------------
// Fixed-star catalogue (only the stars used to define ayanamsas)
// ---------------------------------------------------------------------------

/**
 * ICRS astrometry, matching the entries Swiss Ephemeris ships in `sefstars.txt`
 * so that star-defined ayanamsas agree with SE/JHora rather than drifting by
 * the ~1 mas/yr difference between Hipparcos reductions.
 */
export interface StarData {
    name:     string;
    /** Right ascension at J2000, degrees (ICRS). */
    ra:       number;
    /** Declination at J2000, degrees (ICRS). */
    dec:      number;
    /** Proper motion in RA, μα·cos δ, mas/yr. */
    pmRA:     number;
    /** Proper motion in declination, mas/yr. */
    pmDec:    number;
    /** Parallax, mas. */
    parallax: number;
    /** Radial velocity, km/s. */
    radVel:   number;
}

const hms = (h: number, m: number, s: number): number => (h + m / 60 + s / 3600) * 15;
const dms = (d: number, m: number, s: number): number =>
    Math.sign(d || 1) * (Math.abs(d) + m / 60 + s / 3600);

export const STARS: Record<string, StarData> = {
    /** Chitra — α Virginis. Defines True Chitrapaksha. */
    Spica: {
        name: 'Spica (Chitra, α Vir)',
        ra:   hms(13, 25, 11.5793),
        dec:  dms(-11, 9, 40.759),
        pmRA: -42.50, pmDec: -31.73, parallax: 12.44, radVel: 1.0,
    },
    /** Pushya — δ Cancri (Asellus Australis). Defines True Pushya paksha. */
    DeltaCancri: {
        name: 'Asellus Australis (Pushya, δ Cnc)',
        ra:   hms(8, 44, 41.0996),
        dec:  dms(18, 9, 15.511),
        pmRA: -17.65, pmDec: -228.9, parallax: 24.98, radVel: 17.1,
    },
    /** Revati — ζ Piscium. Defines True Revati. */
    ZetaPiscium: {
        name: 'Revati (ζ Psc)',
        ra:   hms(1, 13, 43.8869),
        dec:  dms(7, 34, 31.274),
        pmRA: -52.85, pmDec: -9.48, parallax: 14.87, radVel: 5.4,
    },
    /** Mula — λ Scorpii (Shaula). Defines True Mula. */
    LambdaScorpii: {
        name: 'Shaula (Mula, λ Sco)',
        ra:   hms(17, 33, 36.5200),
        dec:  dms(-37, 6, 13.765),
        pmRA: -8.90, pmDec: -29.95, parallax: 4.64, radVel: 0.0,
    },
};

// ---------------------------------------------------------------------------
// Star position → mean ecliptic of date
// ---------------------------------------------------------------------------

/**
 * Longitude of a fixed star in the **mean ecliptic and equinox of date**,
 * in degrees.
 *
 * Applies space motion (proper motion + radial velocity) and, optionally,
 * annual parallax. Nutation is excluded by definition — ayanamsa is referred to
 * the mean equinox. Annual aberration is excluded by default: including it
 * would make the ayanamsa oscillate by ±20″ over each year, which is not how
 * panchanga ayanamsa is tabulated.
 *
 * @param star        Catalogue entry
 * @param jdUT        Julian Day, UT
 * @param observerAU  Optional observer barycentric position (AU, ICRF) for parallax
 */
export function starLongitudeOfDate(
    star: StarData,
    jdUT: number,
    observerAU?: Vec,
): number {
    const jdTT = jdUT + deltaT(jdUT) / 86400.0;
    const years = (jdTT - 2451545.0) / 365.25;

    // ── J2000 ICRS direction ────────────────────────────────────────────────
    const ra  = star.ra  * DEG;
    const dec = star.dec * DEG;
    const cosD = Math.cos(dec), sinD = Math.sin(dec);
    const cosR = Math.cos(ra),  sinR = Math.sin(ra);

    const p: Vec = [cosD * cosR, cosD * sinR, sinD];

    // ── Distance from parallax; guard against zero/negative catalogue values ─
    const parallaxArcsec = star.parallax / 1000.0;
    const distAU = parallaxArcsec > 0
        ? (1 / parallaxArcsec) * PC_IN_AU
        : 1e9 * PC_IN_AU;   // effectively at infinity

    // ── Space motion: tangential (proper motion) + radial ────────────────────
    const eRA:  Vec = [-sinR, cosR, 0];
    const eDec: Vec = [-sinD * cosR, -sinD * sinR, cosD];

    const muRA  = star.pmRA  * MAS_TO_RAD;   // rad/yr
    const muDec = star.pmDec * MAS_TO_RAD;   // rad/yr
    const vRad  = star.radVel * KMS_TO_AU_YR;

    // Position in AU at epoch `years` from J2000
    const pos: Vec = [0, 0, 0];
    for (let i = 0; i < 3; i++) {
        const v = distAU * (muRA * eRA[i] + muDec * eDec[i]) + vRad * p[i];
        pos[i] = distAU * p[i] + v * years;
    }

    // ── Annual parallax (12 mas for Spica — included for completeness) ───────
    if (observerAU) {
        pos[0] -= observerAU[0];
        pos[1] -= observerAU[1];
        pos[2] -= observerAU[2];
    }

    // ── ICRF → mean ecliptic & equinox of date ──────────────────────────────
    const T = julianCenturies(jdTT);
    return toSpherical(icrfToMeanEclipticOfDate(pos, T)).lon;
}

// ---------------------------------------------------------------------------
// Ayanamsa model registry
// ---------------------------------------------------------------------------

/** A star-defined ("true") ayanamsa: `star` sits at exactly `atLongitude`. */
interface StarModel {
    kind: 'star';
    star: keyof typeof STARS;
    /** Sidereal longitude the star is pinned to, degrees. */
    atLongitude: number;
    label: string;
}

/** An epoch-defined ayanamsa: `value` degrees at Julian Day `jd`. */
interface EpochModel {
    kind: 'epoch';
    jd: number;
    value: number;
    label: string;
    /** Where the anchor came from — see AYANAMSA_MODELS for the provenance rules. */
    source: 'definition' | 'jhora' | 'provisional';
}

export type AyanamsaModel = StarModel | EpochModel;

/**
 * Swiss Ephemeris `SE_SIDM_*` mode number → model.
 *
 * `source` records where each epoch anchor comes from:
 *
 *   'definition'  — the published definition of the ayanamsa itself.
 *   'provisional' — best available anchor, not yet checked against JHora. Treat
 *                   these as approximate; they may be off by arcminutes.
 *
 * Star-defined entries need no anchor at all and are exact by construction —
 * prefer them. True Chitrapaksha (27) is the project default and is verified
 * against JHora to 0.015″; True Pushya (29) is verified to 0.03″.
 *
 * ── A caution, from experience ──────────────────────────────────────────────
 * An earlier revision carried a mode-1 anchor of 23.926408° at the 1998 chart,
 * described as a JHora reading showing that "JHora's Lahiri sits 4.78′ above the
 * ICRC definition". That was wrong. The figure came from a corrupted transcript
 * whose ayanamsa was 6′ too high and whose planets were correspondingly 6′ too
 * low — the signature of numbers generated from a bad ayanamsa rather than read
 * off a screen. Actual JHora output for that chart reads 23°49′35.07″, which is
 * True Chitrapaksha, and matches this engine to 0.015″.
 *
 * The lesson: an ayanamsa anchor is only as good as the provenance of the single
 * number behind it. Anchor to a published definition, or to a star; do not
 * anchor to a reading you cannot re-verify.
 */
export const AYANAMSA_MODELS: Record<number, AyanamsaModel> = {
    // ── Exact, star-defined: no fitted constants ────────────────────────────
    27: { kind: 'star', star: 'Spica',         atLongitude: 180,           label: 'True Chitrapaksha (Spica at 180°)' },
    29: { kind: 'star', star: 'DeltaCancri',   atLongitude: 106,           label: 'True Pushya (δ Cnc at 106°)' },
    30: { kind: 'star', star: 'ZetaPiscium',   atLongitude: 359 + 50 / 60, label: 'True Revati (ζ Psc at 359°50′)' },
    35: { kind: 'star', star: 'LambdaScorpii', atLongitude: 240,           label: 'True Mula (λ Sco at 240°)' },

    // ── Epoch-defined ───────────────────────────────────────────────────────
    // Fagan/Bradley: 24°02′31.36″ at 1950-01-01.
    0:  { kind: 'epoch', jd: 2433282.5, value: 24.042044444, label: 'Fagan/Bradley', source: 'definition'  },
    // Lahiri: 23°15′00″ at 1956-03-21 0h UT (Indian Calendar Reform Committee).
    1:  { kind: 'epoch', jd: 2435553.5, value: 23.250182,    label: 'Lahiri (ICRC)', source: 'definition'  },
    // Raman: 21°00′00″ at 1900-01-01.
    3:  { kind: 'epoch', jd: 2415020.0, value: 21.0,         label: 'Raman',         source: 'definition'  },
    5:  { kind: 'epoch', jd: 2435553.5, value: 23.1602778,   label: 'Krishnamurti (KP)', source: 'provisional' },
    7:  { kind: 'epoch', jd: 2412543.5, value: 20.8194444,   label: 'Yukteshwar',    source: 'provisional' },
    8:  { kind: 'epoch', jd: 2415020.0, value: 21.0,         label: 'JN Bhasin',     source: 'provisional' },
    18: { kind: 'epoch', jd: 2451545.0, value: 0.0,          label: 'J2000 (no ayanamsa)', source: 'definition' },
};

/** Human-readable name for a mode, for logs and API responses. */
export function ayanamsaName(mode: number): string {
    return AYANAMSA_MODELS[mode]?.label ?? `Unknown (${mode})`;
}

// ---------------------------------------------------------------------------
// Precession of the sidereal zero point
// ---------------------------------------------------------------------------

/**
 * Longitude, in the mean ecliptic of date `jdTo`, of the vernal point that was
 * the equinox at `jdFrom`. This is the accumulated general precession between
 * the two epochs, computed as an exact frame rotation rather than a polynomial.
 *
 * Returned in (−180, 180] so that epochs before `jdFrom` give negative values.
 */
export function accumulatedPrecession(jdFrom: number, jdTo: number): number {
    const vernalAtFrom: Vec = matTransposeVec(
        precessionMatrix(julianCenturies(jdFrom)),
        [1, 0, 0],
    );
    const lon = toSpherical(
        icrfToMeanEclipticOfDate(vernalAtFrom, julianCenturies(jdTo)),
    ).lon;
    return lon > 180 ? lon - 360 : lon;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Ayanamsa in degrees for a given SE mode and Julian Day (UT).
 *
 * @param mode  Swiss Ephemeris SE_SIDM_* code (27 = True Chitrapaksha)
 * @param jd    Julian Day, UT
 */
export function getAyanamsa(mode: number, jd: number): number {
    const model = AYANAMSA_MODELS[mode];

    if (!model) {
        // Fall back to True Chitrapaksha — the project's reference model —
        // rather than silently substituting an unrelated zero point.
        if (mode !== 27) return getAyanamsa(27, jd);
        throw new Error('ayanamsa: True Chitrapaksha model missing from registry');
    }

    if (model.kind === 'star') {
        const lon = starLongitudeOfDate(STARS[model.star], jd);
        return mod360(lon - model.atLongitude);
    }

    return model.value + accumulatedPrecession(model.jd, jd);
}

/**
 * Mean longitude of the Moon's ascending node (Rahu), tropical degrees,
 * referred to the mean ecliptic of date.
 *
 * Meeus, *Astronomical Algorithms* eq. 47.7 — four terms rather than the
 * previous three, which drifted at the 0.001° level over the DE440s span.
 *
 * @param T  Julian centuries (TT) from J2000.0
 */
export function meanLunarNode(T: number): number {
    return mod360(
        125.0445479
        - 1934.1362891 * T
        +    0.0020754 * T ** 2
        +    T ** 3 / 467441
        -    T ** 4 / 60616000,
    );
}

/** Convert a tropical longitude to sidereal by subtracting the ayanamsa. */
export function toSidereal(tropical: number, ayanamsa: number): number {
    return mod360(tropical - ayanamsa);
}
