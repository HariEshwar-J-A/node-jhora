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

import { apparentStarDirection, AU_KM } from './apparent.js';
import { deltaT } from './deltat.js';
import { nutation } from './nutation.js';
import {
    icrfToMeanEclipticOfDate,
    julianCenturies,
    matTransposeVec,
    precessionMatrix,
    toSpherical,
    type Vec,
} from './precession.js';

const DEG = Math.PI / 180;
const MAS_TO_RAD = Math.PI / (180 * 3600 * 1000);
const PC_IN_AU = 206264.806247;
/** km/s → AU/Julian year. */
const KMS_TO_AU_YR = (86400 * 365.25) / AU_KM;

const mod360 = (x: number): number => ((x % 360) + 360) % 360;

/** SE_SIDM modes that are known but intentionally not implemented (see docs/DATA-SOURCES.md). */
export const UNSUPPORTED_AYANAMSA_MODES = new Set<number>([
    2, // De Luce — published anchor does not match SE 2.10 within 1″; not embedded.
    7, // Yukteshwar — published spring-1894 anchor + IAU precession misses SE/JHora by arcminutes.
    8, // J.N. Bhasin — no citable primary anchor that tracks SE 2.10 within 1″.
    28, // True Revati — ζ Psc catalogue + IAU precession misses SE 2.10 at DE440s kernel edges.
]);

/** Thrown when {@link getAyanamsa} is called for a known-but-unimplemented SE_SIDM mode. */
export class UnsupportedAyanamsaModeError extends Error {
    readonly mode: number;

    constructor(mode: number) {
        super(`ayanamsa: SE_SIDM mode ${mode} is not implemented in this engine`);
        this.name = 'UnsupportedAyanamsaModeError';
        this.mode = mode;
    }
}

export type UnknownAyanamsaModeCode = 'not_finite' | 'not_integer' | 'unknown';

/** Thrown for SE_SIDM codes that are neither in {@link AYANAMSA_MODELS} nor {@link UNSUPPORTED_AYANAMSA_MODES}. */
export class UnknownAyanamsaModeError extends Error {
    readonly mode: number;
    readonly code: UnknownAyanamsaModeCode;

    constructor(mode: number, code: UnknownAyanamsaModeCode) {
        const detail =
            code === 'not_finite'
                ? 'must be a finite number'
                : code === 'not_integer'
                  ? 'must be an integer SE_SIDM code'
                  : 'is not a supported SE_SIDM mode';
        super(`ayanamsa: mode ${String(mode)} ${detail}`);
        this.name = 'UnknownAyanamsaModeError';
        this.mode = mode;
        this.code = code;
    }
}

/** SE_SIDM mode numbers implemented in {@link AYANAMSA_MODELS}. */
export function isRegisteredAyanamsaMode(mode: number): boolean {
    return AYANAMSA_MODELS[mode] !== undefined;
}

/**
 * Reject invalid, unknown, and intentionally unsupported SE_SIDM mode numbers.
 * @throws {UnknownAyanamsaModeError} | {@link UnsupportedAyanamsaModeError}
 */
export function assertValidAyanamsaMode(mode: number): void {
    if (!Number.isFinite(mode)) {
        throw new UnknownAyanamsaModeError(mode, 'not_finite');
    }
    if (!Number.isInteger(mode)) {
        throw new UnknownAyanamsaModeError(mode, 'not_integer');
    }
    if (UNSUPPORTED_AYANAMSA_MODES.has(mode)) {
        throw new UnsupportedAyanamsaModeError(mode);
    }
    if (!isRegisteredAyanamsaMode(mode)) {
        throw new UnknownAyanamsaModeError(mode, 'unknown');
    }
}

// ---------------------------------------------------------------------------
// Fixed-star catalogue (only the stars used to define ayanamsas)
// ---------------------------------------------------------------------------

/**
 * ICRS astrometry, matching the entries Swiss Ephemeris ships in `sefstars.txt`
 * so that star-defined ayanamsas agree with SE/JHora rather than drifting by
 * the ~1 mas/yr difference between Hipparcos reductions.
 */
export interface StarData {
    name: string;
    /** Right ascension at J2000, degrees (ICRS). */
    ra: number;
    /** Declination at J2000, degrees (ICRS). */
    dec: number;
    /** Proper motion in RA, μα·cos δ, mas/yr. */
    pmRA: number;
    /** Proper motion in declination, mas/yr. */
    pmDec: number;
    /** Parallax, mas. */
    parallax: number;
    /** Radial velocity, km/s. */
    radVel: number;
}

const hms = (h: number, m: number, s: number): number => (h + m / 60 + s / 3600) * 15;
const dms = (d: number, m: number, s: number): number =>
    Math.sign(d || 1) * (Math.abs(d) + m / 60 + s / 3600);

/**
 * @provenance Star astrometry (J2000 ICRS position, proper motion, parallax):
 *   - Spica (HIP 65474) and λ Sco (HIP 85927): The Hipparcos Catalogue,
 *     ESA SP-1200 (1997), VizieR I/239 — parallax and proper motions match
 *     that catalogue exactly.
 *   - δ Cnc (HIP 42911): Hipparcos new reduction, van Leeuwen 2007, VizieR
 *     I/311 (parallax 24.98 mas; proper motion within 0.4 mas/yr).
 *   - ζ Psc A (HIP 5737): Hipparcos new reduction, van Leeuwen 2007, VizieR
 *     I/311/hip2 — parallax 18.76 mas, μα* +145.00 / μδ −55.69 mas/yr; the
 *     J2000 position is the I/311 J1991.25 position propagated 8.75 yr with
 *     that proper motion (01h13m43.8873s, +07°34′31.274″).
 *   Radial velocities: CRVAD-2, Kharchenko et al. 2007, VizieR III/254
 *   (Spica 0.0, δ Cnc 17.14 ± 0.20, ζ Psc 15.0 ± 4.9, λ Sco −3.0 km/s).
 *   Only Spica feeds the default (True Chitrapaksha) ayanamsa; at these
 *   speeds radial velocity moves a star's longitude by well under 1e-4″
 *   across the supported range.
 */
export const STARS: Record<string, StarData> = {
    /** Chitra — α Virginis. Defines True Chitrapaksha. */
    Spica: {
        name: 'Spica (Chitra, α Vir)',
        ra: hms(13, 25, 11.5793),
        dec: dms(-11, 9, 40.759),
        pmRA: -42.5,
        pmDec: -31.73,
        parallax: 12.44,
        radVel: 0.0,
    },
    /** Pushya — δ Cancri (Asellus Australis). Defines True Pushya paksha. */
    DeltaCancri: {
        name: 'Asellus Australis (Pushya, δ Cnc)',
        ra: hms(8, 44, 41.0996),
        dec: dms(18, 9, 15.511),
        pmRA: -17.65,
        pmDec: -228.9,
        parallax: 24.98,
        radVel: 17.14,
    },
    /** Revati — ζ Piscium. Defines True Revati. */
    ZetaPiscium: {
        name: 'Revati (ζ Psc)',
        ra: hms(1, 13, 43.8873),
        dec: dms(7, 34, 31.2745),
        pmRA: 145.0,
        pmDec: -55.69,
        parallax: 18.76,
        radVel: 15.0,
    },
    /** Mula — λ Scorpii (Shaula). Defines True Mula. */
    LambdaScorpii: {
        name: 'Shaula (Mula, λ Sco)',
        ra: hms(17, 33, 36.52),
        dec: dms(-37, 6, 13.765),
        pmRA: -8.9,
        pmDec: -29.95,
        parallax: 4.64,
        radVel: -3.0,
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
 * annual parallax. Nutation and aberration are excluded: this is the geometric
 * place on the mean ecliptic, which is what True Citra subtracts from geometric
 * (TRUEPOS) planetary longitudes. The value Swiss Ephemeris *reports* from
 * `swe_get_ayanamsa_ut` is the apparent place instead — see {@link getAyanamsa}.
 *
 * @param star        Catalogue entry
 * @param jdUT        Julian Day, UT
 * @param observerAU  Optional observer barycentric position (AU, ICRF) for parallax
 */
export function starLongitudeOfDate(star: StarData, jdUT: number, observerAU?: Vec): number {
    const jdTT = jdUT + deltaT(jdUT) / 86400.0;
    const T = julianCenturies(jdTT);
    return toSpherical(icrfToMeanEclipticOfDate(starIcrfVector(star, jdUT, observerAU), T, jdTT))
        .lon;
}

/**
 * Barycentric state the apparent-place reduction of a star needs.
 * Registered by {@link EphemerisEngine.initialize} from DE440; kept out of
 * this module so ayanamsa does not import the SPK reader.
 */
export interface StarKinematics {
    /** Observer barycentric velocity, km/s, ICRF. */
    velocityKmS: Vec;
    /** Sun → observer, km, ICRF. */
    sunToObserverKm: Vec;
    /** Observer barycentric position, AU, ICRF (annual parallax). */
    observerAU: Vec;
}

let kinematicsProvider: ((jdUT: number) => StarKinematics) | null = null;

/** Install (or clear) the DE440 kinematics used by apparent star ayanamsa. */
export function setStarKinematicsProvider(fn: ((jdUT: number) => StarKinematics) | null): void {
    kinematicsProvider = fn;
}

/**
 * Geometric ICRF position of a catalogue star at `jdUT`, in AU.
 * Space motion follows the standard linear proper-motion + radial-velocity
 * reduction (Urban & Seidelmann, *Explanatory Supplement*, §7.2 / the Hipparcos
 * catalogue notes). The result is not a unit vector.
 */
function starIcrfVector(star: StarData, jdUT: number, observerAU?: Vec): Vec {
    const jdTT = jdUT + deltaT(jdUT) / 86400.0;
    const years = (jdTT - 2451545.0) / 365.25;

    // ── J2000 ICRS direction ────────────────────────────────────────────────
    const ra = star.ra * DEG;
    const dec = star.dec * DEG;
    const cosD = Math.cos(dec),
        sinD = Math.sin(dec);
    const cosR = Math.cos(ra),
        sinR = Math.sin(ra);

    const p: Vec = [cosD * cosR, cosD * sinR, sinD];

    // ── Distance from parallax; guard against zero/negative catalogue values ─
    const parallaxArcsec = star.parallax / 1000.0;
    const distAU = parallaxArcsec > 0 ? (1 / parallaxArcsec) * PC_IN_AU : 1e9 * PC_IN_AU; // effectively at infinity

    // ── Space motion: tangential (proper motion) + radial ────────────────────
    const eRA: Vec = [-sinR, cosR, 0];
    const eDec: Vec = [-sinD * cosR, -sinD * sinR, cosD];

    const muRA = star.pmRA * MAS_TO_RAD; // rad/yr
    const muDec = star.pmDec * MAS_TO_RAD; // rad/yr
    const vRad = star.radVel * KMS_TO_AU_YR;

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

    return pos;
}

/**
 * Apparent longitude of a star on the **mean** ecliptic of date.
 *
 * This is what `swe_get_ayanamsa_ut` is measured to return for a star-defined
 * mode: the star's apparent place (annual aberration and solar deflection,
 * annual parallax) with nutation left off, so Spica's reported ayanamsa is
 * its apparent mean-ecliptic longitude minus 180°. Swiss Ephemeris general
 * documentation §2.8.5 item 27 and §2.8.12 method 4: Spica is exactly 180°
 * both geometrically and apparently, and the ayanamsa that produces each is
 * a different number. `swe_get_ayanamsa_ut` is the apparent one, without nutation.
 */
function starApparentLongitude(star: StarData, jdUT: number): number {
    const kin = kinematicsProvider?.(jdUT);
    if (!kin) {
        throw new Error(
            'Apparent star ayanamsa needs the barycentric velocity of the Earth from DE440. ' +
                'Call EphemerisEngine.initialize() first.',
        );
    }

    const pos = starIcrfVector(star, jdUT, kin.observerAU);
    const n = Math.hypot(pos[0], pos[1], pos[2]);
    const geometric: Vec = [pos[0] / n, pos[1] / n, pos[2] / n];
    const apparent = apparentStarDirection(geometric, kin.velocityKmS, kin.sunToObserverKm);

    const jdTT = jdUT + deltaT(jdUT) / 86400.0;
    return toSpherical(icrfToMeanEclipticOfDate(apparent, julianCenturies(jdTT), jdTT)).lon;
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

/**
 * True ayanamsa at a reference epoch, stored as mean by subtracting IAU 1980
 * nutation in longitude at that instant, then propagated with IAU 2006 precession
 * (same rotation as other epoch modes). Matches Swiss Ephemeris `SIDM_LAHIRI_ICRC`.
 */
interface TrueEpochModel {
    kind: 'true_epoch';
    jd: number;
    /** True (nutation-bearing) ayanamsa at `jd`, degrees. */
    trueValue: number;
    label: string;
    source: 'definition';
}

export type AyanamsaModel = StarModel | EpochModel | TrueEpochModel;

/** B.V. Raman, *Hindu Predictive Astrology*, App. A: (year − 397) × 50⅓″ at 1900 January 0.5. */
const RAMAN_AYANAMSA_1900_DEG = ((1900 - 397) * (50 + 1 / 3)) / 3600;

function nutationLongitudeDegrees(jdUT: number): number {
    const jdTT = jdUT + deltaT(jdUT) / 86400.0;
    return nutation(julianCenturies(jdTT)).dpsi;
}

function meanAyanamsaFromTrueEpoch(trueValue: number, anchorJd: number, jd: number): number {
    const meanAtAnchor = trueValue - nutationLongitudeDegrees(anchorJd);
    return meanAtAnchor + accumulatedPrecession(anchorJd, jd);
}

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
/**
 * @provenance Star models: the star and the longitude it is pinned to are the
 * published definitions (e.g. Chitrapaksha: Spica at 180°). Epoch models: the
 * per-entry comment and `source` field give the definition each anchor comes
 * from; 'provisional' entries are flagged as unverified.
 */
export const AYANAMSA_MODELS: Record<number, AyanamsaModel> = {
    // ── Exact, star-defined: no fitted constants ────────────────────────────
    27: {
        kind: 'star',
        star: 'Spica',
        atLongitude: 180,
        label: 'True Chitrapaksha (Spica at 180°)',
    },
    29: {
        kind: 'star',
        star: 'DeltaCancri',
        atLongitude: 106,
        label: 'True Pushya (δ Cnc at 106°)',
    },
    35: {
        kind: 'star',
        star: 'LambdaScorpii',
        atLongitude: 240,
        label: 'True Mula (λ Sco at 240°)',
    },

    // ── Epoch-defined ───────────────────────────────────────────────────────
    // Fagan/Bradley: 24°02′31.36″ at 1950-01-01.
    0: {
        kind: 'epoch',
        jd: 2433282.5,
        value: 24.042044444,
        label: 'Fagan/Bradley',
        source: 'definition',
    },
    // Lahiri (SE_SIDM_LAHIRI = 1). See docs/DATA-SOURCES.md.
    1: {
        kind: 'epoch',
        jd: 2415020.0,
        value: 22 + 27 / 60 + 37.76 / 3600,
        label: 'Lahiri',
        source: 'definition',
    },
    // Raman (SE_SIDM_RAMAN = 3). See docs/DATA-SOURCES.md.
    3: {
        kind: 'epoch',
        jd: 2415020.0,
        value: RAMAN_AYANAMSA_1900_DEG,
        label: 'Raman',
        source: 'definition',
    },
    // Krishnamurti / KP (SE_SIDM_KRISHNAMURTI = 5). See docs/DATA-SOURCES.md.
    5: {
        kind: 'epoch',
        jd: 2415020.0,
        value: 22 + 21 / 60 + 50 / 3600,
        label: 'Krishnamurti (KP)',
        source: 'definition',
    },
    18: {
        kind: 'epoch',
        jd: 2451545.0,
        value: 0.0,
        label: 'J2000 (no ayanamsa)',
        source: 'definition',
    },
    // Lahiri ICRC (SE_SIDM_LAHIRI_ICRC = 46). CRC 1955 true ayanamsa; see docs/DATA-SOURCES.md.
    46: {
        kind: 'true_epoch',
        jd: 2435553.5,
        trueValue: 23 + 15 / 60,
        label: 'Lahiri ICRC',
        source: 'definition',
    },
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
        precessionMatrix(julianCenturies(jdFrom), jdFrom),
        [1, 0, 0],
    );
    const lon = toSpherical(
        icrfToMeanEclipticOfDate(vernalAtFrom, julianCenturies(jdTo), jdTo),
    ).lon;
    return lon > 180 ? lon - 360 : lon;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Which place of the defining star `getAyanamsa` reduces.
 *
 *   • `'apparent'`  — aberration and solar deflection, no nutation. This is
 *     `swe_get_ayanamsa_ut` (Swiss Ephemeris general doc §2.8.5 / §2.8.12).
 *   • `'geometric'` — neither aberration nor deflection. This is the zero point
 *     subtracted from TRUEPOS sidereal planets, and the number JHora prints
 *     for the 1998 reference chart (`23-51-11.00`).
 *
 * Epoch-defined modes have no star-dependent aberration; `apparent` and
 * `geometric` return the same mean propagated value (matching
 * `swe_get_ayanamsa_ut` for fixed-epoch systems).
 */
export type AyanamsaFrame = 'apparent' | 'geometric';

/**
 * Ayanamsa in degrees for a given SE mode and Julian Day (UT).
 *
 * @param mode   Swiss Ephemeris SE_SIDM_* code (27 = True Chitrapaksha)
 * @param jd     Julian Day, UT
 * @param frame  Star-defined modes only. Defaults to the geometric place JHora
 *               subtracts; 'apparent' is the swe_get_ayanamsa_ut value (opt-in).
 */
export function getAyanamsa(mode: number, jd: number, frame: AyanamsaFrame = 'geometric'): number {
    assertValidAyanamsaMode(mode);
    const model = AYANAMSA_MODELS[mode]!;

    if (model.kind === 'star') {
        const lon =
            frame === 'geometric'
                ? starLongitudeOfDate(STARS[model.star], jd)
                : starApparentLongitude(STARS[model.star], jd);
        return mod360(lon - model.atLongitude);
    }

    if (model.kind === 'true_epoch') {
        return mod360(meanAyanamsaFromTrueEpoch(model.trueValue, model.jd, jd));
    }

    return mod360(model.value + accumulatedPrecession(model.jd, jd));
}

/** True ayanamsa (mean + nutation in longitude) for a `true_epoch` model at `jd` UT. */
export function trueAyanamsaFromModel(model: TrueEpochModel, jd: number): number {
    return mod360(
        meanAyanamsaFromTrueEpoch(model.trueValue, model.jd, jd) + nutationLongitudeDegrees(jd),
    );
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
        125.0445479 - 1934.1362891 * T + 0.0020754 * T ** 2 + T ** 3 / 467441 - T ** 4 / 60616000,
    );
}

/** Convert a tropical longitude to sidereal by subtracting the ayanamsa. */
export function toSidereal(tropical: number, ayanamsa: number): number {
    return mod360(tropical - ayanamsa);
}
