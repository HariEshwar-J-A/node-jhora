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
import { ayanamsaForGalacticNode } from './ayanamsa-galactic.js';
import { invariableEclipticLongitude } from './ayanamsa-invariable-plane.js';
import {
    AYANAMSA_FLAGS,
    AYANAMSA_MODE_USER,
    type AyanamsaOptions,
    hasAyanamsaFlag,
} from './ayanamsa-options.js';
import {
    AYANAMSA_MODEL_DEFS,
    type AyanamsaModelDef,
    type EpochModelDef,
    LAHIRI_ANCHOR_JD,
    LAHIRI_TRUE_AT_ANCHOR_DEG,
    meanAtAnchorForProfile,
    type ProfileMean,
} from './ayanamsa-registry.js';
import { deltaT, getDeltaTContext, type PrecisionProfile } from './deltat.js';
import { earthGeocenterBarycentricAu } from './earth-geocenter-barycentric.js';
import { nutation } from './nutation.js';
import {
    iau2000FrameBias,
    icrfToMeanEclipticOfDate,
    julianCenturies,
    matTransposeVec,
    matVec,
    meanObliquity,
    precessionMatrix,
    rotateX,
    toSpherical,
    type Vec,
} from './precession.js';
import { DE440S_JD_TDB_END, DE440S_JD_TDB_START } from './provider/de440s.js';
import { effectiveStarParallaxMode } from './star-parallax.js';

export type { AyanamsaOptions } from './ayanamsa-options.js';
export { AYANAMSA_FLAGS, AYANAMSA_MODE_USER, hasAyanamsaFlag } from './ayanamsa-options.js';
export {
    AYANAMSA_MODEL_DEFS,
    LAHIRI_ANCHOR_JD,
    LAHIRI_TRUE_AT_ANCHOR_DEG,
    meanAtAnchorForProfile,
} from './ayanamsa-registry.js';

const DEG = Math.PI / 180;
const MAS_TO_RAD = Math.PI / (180 * 3600 * 1000);
const PC_IN_AU = 206264.806247;
/** km/s → AU/Julian year. */
const KMS_TO_AU_YR = (86400 * 365.25) / AU_KM;

const mod360 = (x: number): number => ((x % 360) + 360) % 360;

/** Reserved mode numbers with no public definition (see docs/DATA-SOURCES.md). */
export const UNSUPPORTED_AYANAMSA_MODES = new Set<number>([]);

/** Thrown when {@link getAyanamsa} is called for a known-but-unimplemented ayanamsa mode. */
export class UnsupportedAyanamsaModeError extends Error {
    readonly mode: number;

    constructor(mode: number) {
        super(`ayanamsa: mode ${mode} is not implemented in this engine`);
        this.name = 'UnsupportedAyanamsaModeError';
        this.mode = mode;
    }
}

export type UnknownAyanamsaModeCode = 'not_finite' | 'not_integer' | 'unknown';

/** Thrown for mode numbers that are neither in {@link AYANAMSA_MODELS} nor {@link UNSUPPORTED_AYANAMSA_MODES}. */
export class UnknownAyanamsaModeError extends Error {
    readonly mode: number;
    readonly code: UnknownAyanamsaModeCode;

    constructor(mode: number, code: UnknownAyanamsaModeCode) {
        const detail =
            code === 'not_finite'
                ? 'must be a finite number'
                : code === 'not_integer'
                  ? 'must be an integer ayanamsa mode number'
                  : 'is not a supported ayanamsa mode';
        super(`ayanamsa: mode ${String(mode)} ${detail}`);
        this.name = 'UnknownAyanamsaModeError';
        this.mode = mode;
        this.code = code;
    }
}

/** Mode numbers implemented in {@link AYANAMSA_MODEL_DEFS} (and USER 255). */
export function isRegisteredAyanamsaMode(mode: number): boolean {
    return AYANAMSA_MODEL_DEFS[mode] !== undefined || mode === AYANAMSA_MODE_USER;
}

/**
 * Reject invalid, unknown, and intentionally unsupported ayanamsa mode numbers.
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
    if (mode === AYANAMSA_MODE_USER) {
        return;
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

/** Spica (α Vir, HIP 65474) for the jhora profile — Hipparcos 1997 (VizieR I/239). */
const SPICA_JHORA: StarData = {
    name: 'Spica (Chitra, α Vir)',
    ra: hms(13, 25, 11.5793),
    dec: dms(-11, 9, 40.759),
    pmRA: -42.5,
    pmDec: -31.73,
    parallax: 12.44,
    radVel: 0.0,
};

/**
 * Spica for the modern profile — van Leeuwen 2007 new reduction (A&A 474, 653;
 * VizieR I/311) with SIMBAD radial velocity +1.0 km/s (SE 2.10 built-in star).
 */
const SPICA_MODERN: StarData = {
    name: 'Spica (Chitra, α Vir, vL2007)',
    ra: hms(13, 25, 11.57937),
    dec: dms(-11, 9, 40.7501),
    pmRA: -42.35,
    pmDec: -30.67,
    parallax: 13.06,
    radVel: 1.0,
};

/**
 * @provenance Star astrometry (J2000 ICRS position, proper motion, parallax):
 *   - Spica jhora record: Hipparcos Catalogue, ESA SP-1200 (1997), VizieR I/239.
 *   - Spica modern record: van Leeuwen 2007, VizieR I/311; RV SIMBAD +1.0 km/s.
 *   - λ Sco (HIP 85927): The Hipparcos Catalogue,
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
    /** Chitra — α Virginis (jhora profile catalogue; see {@link spicaForProfile}). */
    Spica: SPICA_JHORA,
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
    /**
     * Galactic centre (Sgr A*) — ICRS (Reid & Brunthaler 2004; Malkin 2012).
     * RA 17h45m40.036s, Dec −29°00′28.17″; zero proper motion at this precision.
     */
    GalacticCenter: {
        name: 'Galactic centre (Sgr A*)',
        ra: hms(17, 45, 40.036),
        dec: dms(-29, 0, 28.17),
        pmRA: 0,
        pmDec: 0,
        parallax: 0,
        radVel: 0,
    },
};

/** True Chitrapaksha Spica catalogue entry for a precision profile (ADR 0015). */
export function spicaForProfile(profile: PrecisionProfile): StarData {
    return profile === 'modern' ? SPICA_MODERN : SPICA_JHORA;
}

function starDataForModel(starKey: keyof typeof STARS, profile: PrecisionProfile): StarData {
    if (starKey === 'Spica') return spicaForProfile(profile);
    return STARS[starKey];
}

// ---------------------------------------------------------------------------
// Star position → mean ecliptic of date
// ---------------------------------------------------------------------------

/**
 * Longitude of a fixed star in the **mean ecliptic and equinox of date**,
 * in degrees.
 *
 * Applies space motion (proper motion + radial velocity) and, optionally,
 * annual parallax (Urban & Seidelmann, *Explanatory Supplement*, §7.2). Nutation
 * and aberration are excluded: this is the geometric place on the mean ecliptic,
 * which is what True Citra subtracts from geometric (TRUEPOS) planetary
 * longitudes. The modern profile passes the geocentre barycentric position here
 * for star-defined modes; the jhora profile leaves the observer unset (barycentric
 * star place). See {@link getAyanamsa} for the apparent star place.
 *
 * @param star        Catalogue entry
 * @param jdUT        Julian Day, UT
 * @param observerAU  Geocentre barycentric position (AU, ICRF) for annual parallax
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

    // ── Annual parallax (geometric observer offset, Explanatory Supplement §7.2) ─
    if (observerAU) {
        pos[0] -= observerAU[0];
        pos[1] -= observerAU[1];
        pos[2] -= observerAU[2];
    }

    return pos;
}

function starGeometricLongitude(star: StarData, jd: number, profile: PrecisionProfile): number {
    if (profile === 'modern') {
        const jdTdb = jd + deltaT(jd) / 86400.0;
        const insideKernel = jdTdb >= DE440S_JD_TDB_START && jdTdb <= DE440S_JD_TDB_END;
        const mode = effectiveStarParallaxMode();
        if (mode === 'oracle-compat') {
            if (insideKernel) {
                const kin = kinematicsProvider?.(jd);
                if (!kin) {
                    throw new Error(
                        'Modern geometric star ayanamsa needs the geocentre barycentric position from DE440. ' +
                            'Call EphemerisEngine.initialize() first.',
                    );
                }
                return starLongitudeOfDate(star, jd, kin.observerAU);
            }
            return starLongitudeOfDate(star, jd);
        }
        if (mode === 'continuous') {
            return starLongitudeOfDate(star, jd, earthGeocenterBarycentricAu(jd));
        }
    }
    return starLongitudeOfDate(star, jd);
}

function starLongitudeForAyanamsa(
    star: StarData,
    jd: number,
    profile: PrecisionProfile,
    frame: AyanamsaFrame,
    useInvariablePlane: boolean,
): number {
    if (useInvariablePlane) {
        const jdTdb = jd + deltaT(jd) / 86400.0;
        const inKernel = jdTdb >= DE440S_JD_TDB_START && jdTdb <= DE440S_JD_TDB_END;
        const observerAU =
            profile === 'modern' && inKernel ? kinematicsProvider?.(jd)?.observerAU : undefined;
        const vec = starIcrfVector(star, jd, observerAU);
        return invariableEclipticLongitude(vec, jd);
    }
    if (frame === 'geometric') {
        return starGeometricLongitude(star, jd, profile);
    }
    return starApparentLongitude(star, jd, profile);
}

function pinLongitude(atLongitude: ProfileMean, profile: PrecisionProfile): number {
    return meanAtAnchorForProfile(atLongitude, profile);
}

/**
 * Apparent longitude of a star on the **mean** ecliptic of date.
 *
 * Apparent place for a star-defined mode (annual aberration and solar deflection,
 * annual parallax) with nutation left off — the modern-profile convention matched
 * by pyswisseph 2.10.03 black-box ayanamsa output per mode number. Spica is
 * exactly 180° both geometrically and apparently, and the ayanamsa that produces
 * each is a different number; the apparent one omits nutation.
 */
function starApparentLongitude(star: StarData, jdUT: number, profile: PrecisionProfile): number {
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
    let apparent = apparentStarDirection(geometric, kin.velocityKmS, kin.sunToObserverKm);

    // IAU 2000 frame bias after aberration, before precession to the mean
    // equator of date (IERS Conventions 2010 eq. 5.21; ERFA bi00/bp00, BSD-3).
    if (profile === 'modern') {
        apparent = iau2000FrameBias(apparent);
    }

    const jdTT = jdUT + deltaT(jdUT) / 86400.0;
    return toSpherical(icrfToMeanEclipticOfDate(apparent, julianCenturies(jdTT), jdTT)).lon;
}

// ---------------------------------------------------------------------------
// Model registry (see ayanamsa-registry.ts)
// ---------------------------------------------------------------------------

/** @deprecated Use {@link AYANAMSA_MODEL_DEFS}. Kept for tests and API reports. */
export const AYANAMSA_MODELS: Record<number, AyanamsaModelDef> = AYANAMSA_MODEL_DEFS;

export type AyanamsaModel = AyanamsaModelDef;

/**
 * IAU 2000A (+ IAU 2006 adjustment) nutation in longitude at the Lahiri anchor,
 * arcseconds (Bhatnagar / CRC demeaning for jhora profile).
 */
export const LAHIRI_IAU2000A_DPSI_AT_ANCHOR_ARCSEC = 16.7769;

/**
 * General-precession bridge IAU 1976 / IAE vs IAU 2006 p_A at the Lahiri anchor
 * (modern profile only), arcseconds.
 */
export const LAHIRI_IAU1976_PRECESSION_CORRECTION_ARCSEC = 0.13036;

function nutationLongitudeDegrees(jdUT: number): number {
    const jdTT = jdUT + deltaT(jdUT) / 86400.0;
    return nutation(julianCenturies(jdTT)).dpsi;
}

function propagateMeanEpochAyanamsa(meanAtAnchor: number, anchorJd: number, jd: number): number {
    return mod360(meanAtAnchor - meanEquinoxLongitudeOnEclipticOf(anchorJd, jd));
}

let aldebaranFrozenMeanCache: number | undefined;

function aldebaranFrozenMeanAtAnchor(jd: number, minusDeg: number): number {
    if (aldebaranFrozenMeanCache === undefined) {
        // van Leeuwen 2007, A&A 474, 653 (HIP 21421).
        const star: StarData = {
            name: 'HIP 21421',
            ra: hms(4, 35, 55.23907),
            dec: dms(16, 30, 33.4885),
            pmRA: 63.45,
            pmDec: -188.94,
            parallax: 48.94,
            radVel: 54.26,
        };
        aldebaranFrozenMeanCache = mod360(starGeometricLongitude(star, jd, 'modern') - minusDeg);
    }
    return aldebaranFrozenMeanCache;
}

function getEpochAyanamsa(
    model: EpochModelDef,
    jd: number,
    profile: PrecisionProfile,
    ayanamsaFlags: number | undefined,
): number {
    let mean0 = meanAtAnchorForProfile(model.meanAtAnchor, profile);
    let anchorJd = model.jd;
    if (model.freezeStarLongitudeMinusDeg !== undefined) {
        mean0 = aldebaranFrozenMeanAtAnchor(anchorJd, model.freezeStarLongitudeMinusDeg);
    } else if (anchorJd === 0) {
        const y = -0.106;
        anchorJd =
            2451623.80984 +
            365242.37404 * y +
            0.05169 * y * y -
            0.00411 * y * y * y -
            0.00057 * y * y * y * y;
    }
    if (hasAyanamsaFlag(ayanamsaFlags, AYANAMSA_FLAGS.ECL_DATE)) {
        return mod360(mean0 + accumulatedPrecession(anchorJd, jd));
    }
    return propagateMeanEpochAyanamsa(mean0, anchorJd, jd);
}

function meanAyanamsaFromTrueEpoch(
    trueValue: number,
    anchorJd: number,
    jd: number,
    profile: PrecisionProfile,
): number {
    const dpsiDeg = nutationLongitudeDegrees(anchorJd);
    const bridgeDeg = profile === 'modern' ? LAHIRI_IAU1976_PRECESSION_CORRECTION_ARCSEC / 3600 : 0;
    const mean0 = trueValue - dpsiDeg + bridgeDeg;
    return propagateMeanEpochAyanamsa(mean0, anchorJd, jd);
}

/** Human-readable name for a mode, for logs and API responses. */
export function ayanamsaName(mode: number): string {
    if (mode === AYANAMSA_MODE_USER) return 'User-defined';
    return AYANAMSA_MODEL_DEFS[mode]?.label ?? `Unknown (${mode})`;
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

/**
 * Longitude, on the **mean ecliptic of `jdAnchor`**, of the mean equinox at `jd`.
 * This is the traditional Lahiri precession term P(t0→t) (ecliptic of t0).
 */
export function meanEquinoxLongitudeOnEclipticOf(jdAnchor: number, jd: number): number {
    const jdTTAnchor = jdAnchor + deltaT(jdAnchor) / 86400.0;
    const jdTT = jd + deltaT(jd) / 86400.0;
    const TAnchor = julianCenturies(jdTTAnchor);
    const T = julianCenturies(jdTT);
    const vernalAtJd: Vec = matTransposeVec(precessionMatrix(T, jdTT), [1, 0, 0]);
    const onAnchorEcliptic = rotateX(
        matVec(precessionMatrix(TAnchor, jdTTAnchor), vernalAtJd),
        meanObliquity(TAnchor, jdTTAnchor),
    );
    const lon = toSpherical(onAnchorEcliptic).lon;
    return lon > 180 ? lon - 360 : lon;
}

function lahiriMeanAtAnchor(profile: PrecisionProfile): number {
    const dpsiDeg =
        profile === 'modern'
            ? nutationLongitudeDegrees(LAHIRI_ANCHOR_JD)
            : LAHIRI_IAU2000A_DPSI_AT_ANCHOR_ARCSEC / 3600;
    const bridgeDeg = profile === 'modern' ? LAHIRI_IAU1976_PRECESSION_CORRECTION_ARCSEC / 3600 : 0;
    return LAHIRI_TRUE_AT_ANCHOR_DEG - dpsiDeg + bridgeDeg;
}

function getLahiriAyanamsa(jd: number, profile: PrecisionProfile): number {
    const mean0 = lahiriMeanAtAnchor(profile);
    return mod360(mean0 - meanEquinoxLongitudeOnEclipticOf(LAHIRI_ANCHOR_JD, jd));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Which place of the defining star `getAyanamsa` reduces.
 *
 *   • `'apparent'`  — aberration and solar deflection, no nutation (modern
 *     profile; matches pyswisseph 2.10.03 black-box ayanamsa per mode number).
 *   • `'geometric'` — neither aberration nor deflection. This is the zero point
 *     subtracted from TRUEPOS sidereal planets, and the number JHora prints
 *     for the 1998 reference chart (`23-51-11.00`).
 *
 * Epoch-defined modes have no star-dependent aberration; `apparent` and
 * `geometric` return the same mean propagated value (same as the modern oracle
 * for fixed-epoch systems).
 */
export type AyanamsaFrame = 'apparent' | 'geometric';

/**
 * Ayanamsa in degrees for a given mode and Julian Day (UT).
 *
 * @param mode   Ayanamsa mode number compatible with publicly documented numbering
 *               (27 = True Chitrapaksha)
 * @param jd     Julian Day, UT
 * @param frame  Star-defined modes only. Defaults to the geometric place JHora
 *               subtracts; 'apparent' is the modern-profile oracle value (opt-in).
 */
export function getAyanamsa(
    mode: number,
    jd: number,
    frame: AyanamsaFrame = 'geometric',
    profile?: PrecisionProfile,
    options?: AyanamsaOptions,
): number {
    if (mode === AYANAMSA_MODE_USER) {
        const user = options?.user;
        if (!user) {
            throw new Error(
                'ayanamsa: mode 255 (USER) requires options.user { t0Jd, ayanamsaDeg }',
            );
        }
        const ayanamsaFlags = options?.ayanamsaFlags;
        const anchorJd = user.t0Jd;
        const mean0 = user.ayanamsaDeg;
        if (hasAyanamsaFlag(ayanamsaFlags, AYANAMSA_FLAGS.ECL_DATE)) {
            return mod360(mean0 + accumulatedPrecession(anchorJd, jd));
        }
        return propagateMeanEpochAyanamsa(mean0, anchorJd, jd);
    }

    assertValidAyanamsaMode(mode);
    const model = AYANAMSA_MODEL_DEFS[mode]!;
    const effectiveProfile = profile ?? getDeltaTContext().profile ?? 'jhora';
    const ayanamsaFlags = options?.ayanamsaFlags;
    const useSsy = hasAyanamsaFlag(ayanamsaFlags, AYANAMSA_FLAGS.SSY_PLANE);

    if (model.kind === 'star') {
        const star = starDataForModel(model.star, effectiveProfile);
        const lon = starLongitudeForAyanamsa(star, jd, effectiveProfile, frame, useSsy);
        return mod360(lon - pinLongitude(model.atLongitude, effectiveProfile));
    }

    if (model.kind === 'lahiri') {
        if (hasAyanamsaFlag(ayanamsaFlags, AYANAMSA_FLAGS.ORIGINAL_PRECESSION)) {
            return getLahiriAyanamsa(jd, 'jhora');
        }
        return getLahiriAyanamsa(jd, effectiveProfile);
    }

    if (model.kind === 'true_epoch') {
        return meanAyanamsaFromTrueEpoch(
            model.trueValue,
            model.jd,
            jd,
            hasAyanamsaFlag(ayanamsaFlags, AYANAMSA_FLAGS.ORIGINAL_PRECESSION)
                ? 'jhora'
                : effectiveProfile,
        );
    }

    if (model.kind === 'galactic_node') {
        return ayanamsaForGalacticNode(jd, model.siderealNodeDeg, model.useLz2010);
    }

    return getEpochAyanamsa(model, jd, effectiveProfile, ayanamsaFlags);
}

/** True ayanamsa (mean + nutation in longitude) for a `true_epoch` model at `jd` UT. */
export function trueAyanamsaFromModel(
    model: Extract<AyanamsaModelDef, { kind: 'true_epoch' }>,
    jd: number,
    profile: PrecisionProfile = 'jhora',
): number {
    return mod360(
        meanAyanamsaFromTrueEpoch(model.trueValue, model.jd, jd, profile) +
            nutationLongitudeDegrees(jd),
    );
}

export {
    meanLunarNode,
    meanLunarNodeFromJdTT,
    meanLunarNodeMeeus,
    meanLunarNodeSpeedDegPerDay,
} from './mean-lunar-node.js';

/** Convert a tropical longitude to sidereal by subtracting the ayanamsa. */
export function toSidereal(tropical: number, ayanamsa: number): number {
    return mod360(tropical - ayanamsa);
}
