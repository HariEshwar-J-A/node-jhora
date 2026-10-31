/**
 * ephemeris.ts — EphemerisEngine backed by JPL DE440s (public domain)
 *
 * Replaces swisseph-wasm (AGPL) with a pure-TypeScript SPK reader against
 * NASA's freely-distributed de440s.bsp file.  The public API is identical to
 * the previous implementation so every caller (analytics, prediction, tools)
 * continues to work without modification.
 *
 * ── Why DE440 instead of Swiss Ephemeris ─────────────────────────────────
 * Swiss Ephemeris is AGPL-3.0.  Any network-facing service (e.g. Telegram
 * bot) must release its entire server-side source under AGPL.  JPL DE440
 * data is U.S. Government public domain — no restrictions at all.
 *
 * ── Measured accuracy ────────────────────────────────────────────────────
 * The contract is JHora: < 1″ on every output against the Swiss Ephemeris
 * 2.02.01 DLL bundled with Jagannatha Hora, over 1850–2150 (DE440s), in
 * tests/golden/jhora-dll.golden.test.ts. JHora's conventions are the
 * defaults: ET = UT + ΔT (deltat.ts), geometric (TRUEPOS) places, and
 * sidereal = tropical − geometric True-Chitra ayanamsa for planets and
 * house angles alike. An SE-2.10-style apparent house frame is opt-in
 * (`siderealFrame: 'se-apparent'`) and is compared, informationally only,
 * in se-parity.golden.test.ts.
 *
 * Outside DE440s coverage the SPK reader throws a RangeError.
 *
 * See also tests/golden/horizons.golden.test.ts and jhora-bridge.golden.test.ts.
 *
 * ── Coordinate chain ─────────────────────────────────────────────────────
 * 1. jdUTtoET(jd)                  UT → TT → ephemeris seconds (applies ΔT)
 * 2. observerState()               Earth barycentric state, plus the observer's
 *                                  geocentric vector when topocentric
 * 3. apparentPlace()               light-time (iterated), solar deflection,
 *                                  relativistic aberration → ICRF direction
 * 4. chartEclipticFromIcrfDirection()  mean ecliptic of date; longitude on
 *                                  the ICRF, latitude after IAU 2000 frame bias
 *                                  (IERS 2010 §5.4.5 and §5.9; dα₀ eq. 5.21,
 *                                  ξ₀ and η₀ eq. 5.33; ADR 0009)
 * 5. toSidereal(lon, ayanamsa)     sidereal longitude
 *
 * Nutation is applied to the *angles* (via apparent sidereal time and true
 * obliquity) but not to planetary longitudes: ayanamsa is referred to the mean
 * equinox of date, so adding nutation there would double-count it.
 *
 * ── Data source ──────────────────────────────────────────────────────────
 * de440s.bsp   Coverage: 1849-12-26 to 2150-01-22  (~32 MB)
 * Shipped in @node-jhora/ephe, or cached by @node-jhora/core/node/ephemeris.
 * https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de440s.bsp
 */

import { DateTime } from 'luxon';

import { Body } from '../core/body.js';
import { NodeJHoraError, NodeJHoraErrorCode } from '../errors.js';
import { dateTimeToJulianDayUt } from '../time/civil.js';
import {
    assertCalendarMode,
    type CalendarMode,
    GregorianReformGapError,
} from '../time/historical.js';
import { CHUNK_PREFETCH_MARGIN_DAYS, PLANET_SPEED_STEP_DAYS } from '../validation/bounds.js';
import {
    assertAyanamsaFrame,
    assertAyanamsaMode,
    assertDeltaTOverrideSeconds,
    assertFiniteNumber,
    assertGeoLocation,
    assertHouseMethod,
    assertJulianDayUt,
    assertLatitude,
    assertNodeType,
    assertNotInitialized,
    assertPositionMode,
    assertPrecisionProfile,
    assertSiderealFrame,
    normalizeLongitude,
    parseEngineDateTime,
    parseEngineDateTimeOrJsDate,
} from '../validation/input.js';
import {
    APPARENT,
    AU_KM,
    type BarycentricSource,
    computePlace,
    GEOMETRIC,
    observerState,
    type PlaceCorrections,
} from './apparent.js';
import {
    assertValidAyanamsaMode,
    type AyanamsaFrame,
    ayanamsaName,
    getAyanamsa as computeAyanamsa,
    setStarKinematicsProvider,
    toSidereal,
} from './ayanamsa.js';
import { getBspBytesLoader } from './bsp-bytes-provider.js';
import {
    computeAscendant,
    computeMC,
    computeVertex,
    getGAST,
    julianCenturies,
    meanObliquity,
    mod360,
    observerGeocentricVector,
    trueObliquity,
    wholeSignCusps,
} from './coordinates.js';
import {
    deltaT,
    type DeltaTContext,
    getDeltaTContext,
    jdUTtoET,
    type PrecisionProfile,
    withDeltaTContext,
} from './deltat.js';
import {
    type HouseAnchorId,
    houseLetterForId,
    type HouseSystemId,
    isHouseLetter,
} from './house-registry.js';
import {
    applyCuspsInMiddle,
    computeTropicalHouses,
    cuspsFromAnchor,
    type HouseLetter,
    ninePadaEqualCusps,
    sssHouseCusps,
} from './house-systems.js';
import {
    APPARENT_SPEED_STEP_DAYS,
    geocentricRelativeState,
    isGeometricPlace,
    meanEclipticRelativeKinematics,
    sphericalRatesDegPerDay,
} from './kinematics.js';
import { computeTrueOsculatingNode } from './lunar-node.js';
import { meanLunarNodeMeeus } from './mean-lunar-node.js';
import { nutation } from './nutation.js';
import {
    chartEclipticFromIcrfDirection,
    iau2000FrameBias,
    icrfToMeanEclipticOfDate,
    toSpherical,
    type Vec,
} from './precession.js';
import { centuryIndex, jdTdbToAstronomicalYear } from './provider/de431-chunk.js';
import { DE440S_JD_TDB_END, DE440S_JD_TDB_START } from './provider/de440s.js';
import {
    CompositeEphemerisProvider,
    type De431ChunkStore,
    type De441ChunkStore,
    type EphemerisPolicy,
    type EphemerisProvenance,
} from './provider/index.js';
import type { SpkFile } from './spk.js';
import { loadSpkFromBytes, NAIF } from './spk.js';

// ---------------------------------------------------------------------------
// Ayanamsa constants — identical to previous version for API compatibility
// ---------------------------------------------------------------------------

/** @provenance Swiss Ephemeris public API `SE_SIDM_*` mode numbers (identifiers, not data). */
export const AYANAMSA = {
    FAGAN_BRADLEY: 0,
    /** Lahiri (SE_SIDM_LAHIRI). */
    LAHIRI: 1,
    /** De Luce (SE_SIDM_DELUCE). */
    DE_LUCE: 2,
    RAMAN: 3,
    KRISHNAMURTI: 5,
    YUKTESHWAR: 7,
    JN_BHASIN: 8,
    J2000: 18,
    /** True Chitrapaksha — Spica pinned to 180°. The project's reference model. */
    TRUE_CITRA: 27,
    TRUE_PUSHYA: 29,
    TRUE_REVATI: 28,
    TRUE_MULA: 35,
    /** Lahiri ICRC variant (SE_SIDM_LAHIRI_ICRC). */
    LAHIRI_ICRC: 46,
} as const;

/**
 * Default sidereal zero point: True Chitrapaksha with Drik Siddhanta.
 * Unlike the epoch-anchored models it needs no fitted constant — it is derived
 * from Spica's computed position, so it is exact at every date.
 */
export const DEFAULT_AYANAMSA: number = AYANAMSA.TRUE_CITRA;

export type AyanamsaMode = (typeof AYANAMSA)[keyof typeof AYANAMSA];

// ---------------------------------------------------------------------------
// Public types — identical to previous version
// ---------------------------------------------------------------------------

/** Precision profile and ΔT override for one engine call (CalculationSettings fields). */
export interface PrecisionOptions {
    /** 'jhora' (default) or 'modern'. See docs/precision-profiles.md. */
    precisionProfile?: PrecisionProfile;
    /** Fixed ΔT, seconds, replacing the profile's ΔT model. */
    deltaTOverrideSeconds?: number;
    /** Civil calendar for Luxon inputs; default `'auto'` (JHora / SE). */
    calendar?: CalendarMode;
    /** When set, skips {@link EphemerisEngine.julday} (e.g. civil time from {@link resolveCivilTime}). */
    julianDayUt?: number;
    /** Settings id for house system when `method` is omitted or is a legacy alias. */
    houseSystemId?: HouseSystemId;
    houseAnchor?: HouseAnchorId;
    cuspsInMiddle?: boolean;
}

function deltaTContextOf(p?: PrecisionOptions): Partial<DeltaTContext> | undefined {
    if (!p || (p.precisionProfile === undefined && p.deltaTOverrideSeconds === undefined))
        return undefined;
    return { profile: p.precisionProfile, overrideSeconds: p.deltaTOverrideSeconds };
}

export interface GeoLocation {
    latitude: number;
    longitude: number;
    altitude?: number;
}

export interface PlanetPosition {
    id: number;
    name: string;
    longitude: number; // Sidereal [0, 360)
    latitude: number; // Ecliptic latitude (degrees)
    distance: number; // AU
    speed: number; // Degrees per day (negative = retrograde)
    declination: number; // Equatorial declination (degrees)
}

export interface HouseData {
    cusps: number[]; // 12 elements, H1 start … H12 start (sidereal)
    ascendant: number; // Sidereal ascendant (degrees)
    mc: number; // Sidereal MC (degrees)
    armc: number; // RAMC = Right Ascension of Midheaven (degrees)
    vertex: number; // Sidereal vertex (degrees)
    equAsc?: number;
    coAscKoch?: number;
    coAscMunkasey?: number;
    polAsc?: number;
    gauquelinSectors?: number[];
    houseFallback?: { code: string; message: string; usedLetter?: string };
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const PLANET_NAMES: Record<number, string> = {
    [Body.Sun]: 'Sun',
    [Body.Moon]: 'Moon',
    [Body.Mercury]: 'Mercury',
    [Body.Venus]: 'Venus',
    [Body.Mars]: 'Mars',
    [Body.Jupiter]: 'Jupiter',
    [Body.Saturn]: 'Saturn',
    [Body.Uranus]: 'Uranus',
    [Body.Neptune]: 'Neptune',
    [Body.Pluto]: 'Pluto',
    [Body.Rahu]: 'Rahu',
    [Body.Ketu]: 'Ketu',
};

/** Our internal planet IDs → NAIF body IDs in de440s.bsp */
const ID_TO_NAIF: Record<number, number> = {
    [Body.Sun]: NAIF.Sun,
    [Body.Moon]: NAIF.Moon,
    [Body.Mercury]: NAIF.Mercury,
    [Body.Venus]: NAIF.Venus,
    [Body.Mars]: NAIF.Mars,
    [Body.Jupiter]: NAIF.Jupiter,
    [Body.Saturn]: NAIF.Saturn,
    [Body.Uranus]: NAIF.Uranus,
    [Body.Neptune]: NAIF.Neptune,
    [Body.Pluto]: NAIF.Pluto,
};

/** Bodies drawn from the SPK file, in the order they are reported (classical default). */
const SPK_BODY_IDS = [
    Body.Sun,
    Body.Moon,
    Body.Mercury,
    Body.Venus,
    Body.Mars,
    Body.Jupiter,
    Body.Saturn,
] as const;

const OUTER_SPK_BODY_IDS = [Body.Uranus, Body.Neptune, Body.Pluto] as const;

export type ZodiacOutput = 'sidereal' | 'tropical';

/**
 * Whether to report where a body *is* or where it is *seen*.
 *
 * 'geometric' — JHora's convention, and this engine's default. No light-time,
 *               aberration or deflection.
 * 'apparent'  — the astronomical standard, matching JPL Horizons and what a
 *               telescope would point at.
 *
 * The two differ by up to ~44″ (Venus near conjunction), so the choice is not
 * cosmetic. Jyotish practice follows JHora.
 */
export type PositionMode = 'geometric' | 'apparent';

/** JHora parity: positions are geometric. */
export const DEFAULT_POSITION_MODE: PositionMode = 'geometric';

/**
 * JHora reports the **true** (osculating) lunar node, not the mean one — its
 * Rahu for the 1998 reference chart matches the osculating node to 0.12″ and
 * misses the mean node by 0.97°. Pass `nodeType: 'mean'` for the smoothed node.
 */
export const DEFAULT_NODE_TYPE: 'mean' | 'true' = 'true';

function correctionsFor(mode: PositionMode): Required<PlaceCorrections> {
    return mode === 'apparent' ? APPARENT : GEOMETRIC;
}

const DEG_RAD = Math.PI / 180;
const RAD_DEG = 180 / Math.PI;

/** Mean ecliptic of date → true equatorial of date (degrees). */
function equatorialFromEcliptic(
    lonDeg: number,
    latDeg: number,
    epsTrueDeg: number,
): {
    raDeg: number;
    decDeg: number;
} {
    const eps = epsTrueDeg * DEG_RAD;
    const lon = lonDeg * DEG_RAD;
    const lat = latDeg * DEG_RAD;
    const sinDec = Math.sin(lat) * Math.cos(eps) + Math.cos(lat) * Math.sin(eps) * Math.sin(lon);
    const dec = Math.asin(sinDec);
    const y = Math.sin(lon) * Math.cos(eps) - Math.tan(lat) * Math.sin(eps);
    const x = Math.cos(lon);
    const ra = Math.atan2(y, x) * RAD_DEG;
    return { raDeg: mod360(ra), decDeg: dec * RAD_DEG };
}

// ---------------------------------------------------------------------------
// EphemerisEngine
// ---------------------------------------------------------------------------

export class EphemerisEngine {
    private static instance: EphemerisEngine;
    private initialized = false;

    private spk!: SpkFile;
    private source!: BarycentricSource;
    private composite!: CompositeEphemerisProvider;
    private chunkStoreDe431?: De431ChunkStore;
    private chunkStoreDe441?: De441ChunkStore;
    private ayanamsaMode: number = DEFAULT_AYANAMSA;

    public constructor() {}

    /** Singleton accessor — mirrors the previous API. */
    public static getInstance(): EphemerisEngine {
        if (!EphemerisEngine.instance) {
            EphemerisEngine.instance = new EphemerisEngine();
        }
        return EphemerisEngine.instance;
    }

    // -----------------------------------------------------------------------
    // Lifecycle
    // -----------------------------------------------------------------------

    /**
     * Load de440s.bsp kernel bytes.
     * Idempotent — subsequent calls are instant no-ops.
     *
     * Pass `kernel` in browsers. In Node, import `@node-jhora/core/node/register`
     * once before initialize, or call `registerNodeBspLoaderFromCore()` after build.
     */
    public async initialize(options?: { kernel?: Uint8Array }): Promise<void> {
        if (this.initialized) return;

        const bytes = options?.kernel ?? (await getBspBytesLoader()?.());

        if (!bytes) {
            throw new NodeJHoraError(
                NodeJHoraErrorCode.EPHEMERIS_UNAVAILABLE,
                'EphemerisEngine: de440s.bsp bytes not available.\n' +
                    '  Browser: pass initialize({ kernel: Uint8Array }) from fetch/arrayBuffer.\n' +
                    '  Node: import and run registerNodeBspLoaderFromCore() from @node-jhora/core/node/register.mjs',
            );
        }

        this.spk = loadSpkFromBytes(bytes);
        this.attachCompositeProvider();
        // Apparent True Citra needs Earth's barycentric velocity (aberration)
        // and the Sun's direction (deflection of Spica), from the same
        // ephemeris source the planets use.
        setStarKinematicsProvider((jdUT) => {
            const et = jdUTtoET(jdUT);
            const earth = this.source.getBarycentric(NAIF.Earth, et);
            const sun = this.source.getBarycentric(NAIF.Sun, et);
            return {
                velocityKmS: [earth.vx, earth.vy, earth.vz],
                sunToObserverKm: [earth.x - sun.x, earth.y - sun.y, earth.z - sun.z],
                observerAU: [earth.x / AU_KM, earth.y / AU_KM, earth.z / AU_KM],
            };
        });
        this.initialized = true;
    }

    private ephemerisPolicy: EphemerisPolicy = 'auto';

    /**
     * Attach DE431 NJCE chunks (legacy long-range kernel).
     * Call before {@link initialize} when ancient dates need DE431 specifically.
     */
    public setChunkStore(store: De431ChunkStore): void {
        this.chunkStoreDe431 = store;
        if (this.initialized) {
            this.attachCompositeProvider();
        }
    }

    /**
     * Attach DE441 NJCE chunks (preferred long-range kernel outside DE440s in `auto`).
     */
    public setDe441ChunkStore(store: De441ChunkStore): void {
        this.chunkStoreDe441 = store;
        if (this.initialized) {
            this.attachCompositeProvider();
        }
    }

    /** Force DE440s, DE431/DE441 long-range, or auto (default). */
    public setEphemerisPolicy(policy: EphemerisPolicy): void {
        this.ephemerisPolicy = policy;
        if (this.composite) this.composite.setPolicy(policy);
    }

    public getEphemerisPolicy(): EphemerisPolicy {
        return this.ephemerisPolicy;
    }

    public getEphemerisProvenance(jd: number): EphemerisProvenance {
        this.checkInit();
        assertJulianDayUt(jd);
        return this.composite.provenance(jd);
    }

    // -----------------------------------------------------------------------
    // Configuration
    // -----------------------------------------------------------------------

    /** Set ayanamsa mode. Accepts AYANAMSA.* constants. */
    public setAyanamsa(mode: number): void {
        this.checkInit();
        assertValidAyanamsaMode(mode);
        this.ayanamsaMode = mode;
    }

    // -----------------------------------------------------------------------
    // Julian Day
    // -----------------------------------------------------------------------

    /**
     * Julian Day (UT) for a Luxon DateTime or JavaScript Date. Civil components
     * are read in `date.zone` and converted with {@link dateTimeToJulianDayUt}.
     */
    public julday(
        date: DateTime | Date,
        options?: { calendar?: CalendarMode; latitude?: number; longitude?: number },
    ): number {
        this.checkInit();
        const dt = parseEngineDateTimeOrJsDate(date);
        const calendar = assertCalendarMode(options?.calendar);
        let jd: number;
        try {
            jd = dateTimeToJulianDayUt(dt, { ...options, calendar });
        } catch (err) {
            if (err instanceof NodeJHoraError) throw err;
            if (err instanceof GregorianReformGapError) {
                throw new NodeJHoraError(NodeJHoraErrorCode.INVALID_INPUT, err.message);
            }
            if (err instanceof RangeError) {
                const code =
                    err.message.includes('Civil year') || err.message.includes('Julian Day')
                        ? NodeJHoraErrorCode.OUT_OF_RANGE
                        : NodeJHoraErrorCode.INVALID_INPUT;
                throw new NodeJHoraError(code, err.message);
            }
            throw err;
        }
        return assertJulianDayUt(jd);
    }

    // -----------------------------------------------------------------------
    // Ayanamsa
    // -----------------------------------------------------------------------

    /**
     * Ayanamsa in degrees at the given Julian Day.
     *
     * @param jd    Julian Day (UT)
     * @param mode  SE_SIDM_* code; defaults to the instance setting. Pass it
     *              explicitly when a caller has already used a per-call
     *              `ayanamsaOrder` for planets, so the reported ayanamsa cannot
     *              drift out of step with the positions it belongs to.
     * @param frame 'geometric' (default, JHora: the value subtracted from
     *              geometric places and house angles) or opt-in 'apparent'
     *              (what SE's swe_get_ayanamsa_ut reports, and what apparent
     *              `positionMode` subtracts).
     */
    public getAyanamsa(
        jd: number,
        mode?: number,
        offsetDeg = 0,
        frame?: AyanamsaFrame,
        precision?: PrecisionOptions,
    ): number {
        this.checkInit();
        assertJulianDayUt(jd);
        const profile = assertPrecisionProfile(precision?.precisionProfile);
        assertDeltaTOverrideSeconds(precision?.deltaTOverrideSeconds);
        const effectiveMode = assertAyanamsaMode(mode ?? this.ayanamsaMode);
        assertFiniteNumber(offsetDeg, 'ayanamsaOffset');
        if (frame !== undefined) assertAyanamsaFrame(frame);
        // 'modern' reports what swe_get_ayanamsa_ut reports: the apparent value.
        const f: AyanamsaFrame = frame ?? (profile === 'modern' ? 'apparent' : 'geometric');
        return withDeltaTContext(
            deltaTContextOf(precision),
            () => computeAyanamsa(effectiveMode, jd, f) + offsetDeg,
        );
    }

    // -----------------------------------------------------------------------
    // Planets
    // -----------------------------------------------------------------------

    /**
     * Compute sidereal planet positions from DE440.
     *
     * @param date      UTC Luxon DateTime
     * @param location  Geographic location (used only for topocentric Moon)
     * @param options   ayanamsaOrder overrides the instance setting for this call
     */
    public getPlanets(
        date: DateTime,
        location?: GeoLocation,
        options: {
            ayanamsaOrder?: number;
            topocentric?: boolean;
            nodeType?: 'mean' | 'true';
            positionMode?: PositionMode;
            /** Constant added to the ayanamsa, degrees. */
            ayanamsaOffset?: number;
            /** When true, append Uranus, Neptune and Pluto after Saturn. Default false. */
            includeOuterPlanets?: boolean;
            /** Sidereal subtracts ayanamsa (default); tropical returns ecliptic of date. */
            zodiac?: ZodiacOutput;
        } & PrecisionOptions = {},
    ): PlanetPosition[] {
        this.checkInit();
        assertPrecisionProfile(options.precisionProfile);
        assertDeltaTOverrideSeconds(options.deltaTOverrideSeconds);
        const ctx = deltaTContextOf(options);
        if (ctx) {
            const rest = {
                ...options,
                precisionProfile: undefined,
                deltaTOverrideSeconds: undefined,
            };
            return withDeltaTContext(ctx, () => this.getPlanets(date, location, rest));
        }

        const dt = parseEngineDateTime(date);
        const {
            ayanamsaOrder,
            topocentric = false,
            nodeType: nodeTypeOpt = DEFAULT_NODE_TYPE,
            positionMode: positionModeOpt = DEFAULT_POSITION_MODE,
            ayanamsaOffset = 0,
            calendar = 'auto',
            julianDayUt: jdOverride,
            includeOuterPlanets = false,
            zodiac = 'sidereal',
        } = options;
        const nodeType = assertNodeType(nodeTypeOpt);
        const positionMode = assertPositionMode(positionModeOpt);
        const effectiveMode = assertAyanamsaMode(ayanamsaOrder ?? this.ayanamsaMode);
        assertFiniteNumber(ayanamsaOffset, 'ayanamsaOffset');
        const loc = assertGeoLocation(location, { required: topocentric });
        const corrections = correctionsFor(positionMode);

        const jd =
            jdOverride ??
            this.julday(dt, {
                calendar,
                latitude: loc?.latitude,
                longitude: loc?.longitude,
            });
        this.prefetchEphemerisChunks(jd);
        this.assertLongRangeChunksForJd(jd);
        // Geometric (TRUEPOS) sidereal positions subtract the geometric star
        // place. Apparent positions subtract the same apparent ayanamsa
        // getAyanamsa() reports, so adding it back recovers the tropical place.
        const frame: AyanamsaFrame = positionMode === 'apparent' ? 'apparent' : 'geometric';
        const ayan =
            zodiac === 'sidereal' ? computeAyanamsa(effectiveMode, jd, frame) + ayanamsaOffset : 0;
        const precisionProfile = options.precisionProfile ?? getDeltaTContext().profile;
        // Sidereal longitudes subtract ayanamsa; speeds follow oracle SP-B2:
        // `jhora` reports tropical TRUEPOS rate (≈ d(tropical)/dt); sidereal FD is
        // lower by d(ayan)/dt (~0.138″/day). `modern` reports sidereal rate =
        // tropical − d(ayan)/dt (geometric True Citra, same 1 s step on ayanamsa).
        const ayanRateForSiderealSpeed =
            zodiac === 'sidereal' && precisionProfile === 'modern'
                ? this.ayanamsaRateDegPerDay(jd, effectiveMode, 'geometric', ayanamsaOffset)
                : 0;

        const planets: PlanetPosition[] = [];

        const bodyIds = includeOuterPlanets
            ? [...SPK_BODY_IDS, ...OUTER_SPK_BODY_IDS]
            : [...SPK_BODY_IDS];

        for (const pid of bodyIds) {
            const naifId = ID_TO_NAIF[pid];

            const topoLoc = topocentric ? loc : undefined;
            const here = this.meanEclipticOfDate(jd, naifId, corrections, topoLoc);
            const motion = this.meanEclipticDailyMotion(jd, naifId, corrections, topoLoc);

            planets.push({
                id: pid,
                name: PLANET_NAMES[pid] ?? `P${pid}`,
                longitude: toSidereal(here.lon, ayan),
                latitude: here.lat,
                distance: here.dist,
                speed: motion.lon - ayanRateForSiderealSpeed,
                declination: this.declinationOf(jd, here.lon, here.lat),
            });
        }

        // ── Lunar nodes ─────────────────────────────────────────────────────
        const node = this.lunarNode(jd, nodeType, precisionProfile, positionMode);
        planets.push({
            id: Body.Rahu,
            name: 'Rahu',
            longitude: toSidereal(node.lon, ayan),
            latitude: 0,
            distance: node.dist,
            speed: node.speed - ayanRateForSiderealSpeed,
            declination: this.declinationOf(jd, node.lon, 0),
        });

        const rahu = planets[planets.length - 1];
        planets.push({
            id: Body.Ketu,
            name: 'Ketu',
            longitude: mod360(rahu.longitude + 180),
            latitude: 0,
            distance: rahu.distance,
            speed: rahu.speed - ayanRateForSiderealSpeed,
            declination: -rahu.declination,
        });

        return planets;
    }

    /** d(ayanamsa)/d(UT day), degrees/day — symmetric 1 s step. */
    private ayanamsaRateDegPerDay(
        jdUT: number,
        mode: number,
        ayanFrame: AyanamsaFrame,
        offsetDeg = 0,
    ): number {
        const h = APPARENT_SPEED_STEP_DAYS;
        const a0 = computeAyanamsa(mode, jdUT - h, ayanFrame) + offsetDeg;
        const a1 = computeAyanamsa(mode, jdUT + h, ayanFrame) + offsetDeg;
        return (a1 - a0) / (2 * h);
    }

    /**
     * Apparent position of an SPK body in the **mean** ecliptic and equinox of
     * date — the frame ayanamsa is defined against.
     *
     * Nutation is deliberately excluded: adding it would double-count, since the
     * sidereal zero point is itself referred to the mean equinox.
     */
    private meanEclipticOfDate(
        jdUT: number,
        naifId: number,
        corrections: Required<PlaceCorrections>,
        location?: GeoLocation,
    ): { lon: number; lat: number; dist: number } {
        const place = this.icrfPlace(jdUT, naifId, corrections, location);
        const ecl = chartEclipticFromIcrfDirection(place.direction, place.T, place.jdTT);
        return { lon: ecl.lon, lat: ecl.lat, dist: place.dist };
    }

    /**
     * ICRF direction before the chart latitude bias. Rise/set applies
     * {@link iau2000FrameBias} to this vector once; chart latitude applies
     * it separately inside {@link chartEclipticFromIcrfDirection}.
     */
    private icrfPlace(
        jdUT: number,
        naifId: number,
        corrections: Required<PlaceCorrections>,
        location?: GeoLocation,
    ): { direction: Vec; dist: number; jdTT: number; T: number } {
        const et = jdUTtoET(jdUT);
        const offset = location
            ? observerGeocentricVector(
                  jdUT,
                  location.latitude,
                  location.longitude,
                  location.altitude ?? 0,
              )
            : undefined;
        const observer = observerState(this.source, NAIF.Earth, et, offset);
        const place = computePlace(this.source, naifId, NAIF.Sun, et, observer, corrections);
        const jdTT = jdUT + deltaT(jdUT) / 86400.0;
        return {
            direction: place.direction as Vec,
            dist: place.distanceAU,
            jdTT,
            T: julianCenturies(jdTT),
        };
    }

    /**
     * Mean or true (osculating) longitude of the Moon's ascending node,
     * tropical degrees in the mean ecliptic of date.
     *
     * The `nodeType` option was previously accepted and silently ignored, so
     * requesting true nodes returned mean ones.
     */
    private lunarNode(
        jdUT: number,
        nodeType: 'mean' | 'true',
        precisionProfile: PrecisionProfile,
        positionMode: PositionMode,
    ): {
        lon: number;
        dist: number;
        speed: number;
    } {
        if (nodeType === 'mean') {
            const jdTT = jdUT + deltaT(jdUT) / 86400.0;
            const T = julianCenturies(jdTT);
            const speed = -1934.1362891 / 36525.0;
            return { lon: meanLunarNodeMeeus(T), dist: 0.002569, speed };
        }

        const source = {
            getBarycentric: (naifBody: number, et: number) =>
                this.composite.getBarycentricForLunarNode(naifBody, et, precisionProfile),
        };
        const geometric = isGeometricPlace(correctionsFor(positionMode));
        const osc = computeTrueOsculatingNode(jdUT, source, {
            precisionProfile,
            truePosition: geometric,
            applyNutation: positionMode === 'apparent',
        });
        return { lon: osc.lon, dist: osc.distAu, speed: osc.speedDegPerDay };
    }

    /**
     * Tropical mean-ecliptic daily motions (deg/day, AU/day).
     *
     * Geometric places: DE Chebyshev velocity through the mean ecliptic frame
     * (see kinematics.ts). Apparent places: central difference on longitude.
     */
    private meanEclipticDailyMotion(
        jdUT: number,
        naifId: number,
        corrections: Required<PlaceCorrections>,
        location?: GeoLocation,
    ): { lon: number; lat: number; dist: number } {
        if (!isGeometricPlace(corrections)) {
            const h = APPARENT_SPEED_STEP_DAYS;
            const before = this.meanEclipticOfDate(jdUT - h, naifId, corrections, location);
            const after = this.meanEclipticOfDate(jdUT + h, naifId, corrections, location);
            let dLon = after.lon - before.lon;
            if (dLon > 180) dLon -= 360;
            if (dLon < -180) dLon += 360;
            return {
                lon: dLon / (2 * h),
                lat: (after.lat - before.lat) / (2 * h),
                dist: (after.dist - before.dist) / (2 * h),
            };
        }

        const et = jdUTtoET(jdUT);
        const offset = location
            ? observerGeocentricVector(
                  jdUT,
                  location.latitude,
                  location.longitude,
                  location.altitude ?? 0,
              )
            : undefined;
        const observer = observerState(this.source, NAIF.Earth, et, offset);
        const { rel, vel } = geocentricRelativeState(this.source, naifId, et, observer);
        const { pos, vel: velEcl } = meanEclipticRelativeKinematics(rel, vel, jdUT);
        return sphericalRatesDegPerDay(pos, velEcl);
    }

    /** Equatorial declination from mean-of-date ecliptic longitude and latitude. */
    private declinationOf(jdUT: number, lon: number, lat: number): number {
        const jdTT = jdUT + deltaT(jdUT) / 86400.0;
        const T = julianCenturies(jdTT);
        const eps = (meanObliquity(T, jdTT) * Math.PI) / 180;
        const l = (lon * Math.PI) / 180;
        const b = (lat * Math.PI) / 180;
        return (
            (Math.asin(Math.sin(b) * Math.cos(eps) + Math.cos(b) * Math.sin(eps) * Math.sin(l)) *
                180) /
            Math.PI
        );
    }

    // -----------------------------------------------------------------------
    // Houses
    // -----------------------------------------------------------------------

    /**
     * Compute house cusps and angles.
     * Supports Whole Sign (recommended for Jyotish).
     *
     * @param jd       Julian Day (UT)
     * @param lat      Geographic latitude
     * @param lon      Geographic longitude
     * @param method   'W' whole sign, 'E' equal, 'P' Placidus, 'O' Porphyry
     * @param sidereal When true (default), all angles have ayanamsa subtracted
     * @param ayanamsaMode   SE_SIDM_* code; defaults to the instance setting
     * @param ayanamsaOffset Constant added to the ayanamsa, degrees
     * @param siderealFrame  How the tropical angles are made sidereal.
     *   • `'jhora'` (default) — subtract the geometric star-defined ayanamsa,
     *     the same zero point the planets use. This is what JHora does: it
     *     takes `swe_houses` tropical angles and subtracts its ayanamsa.
     *   • `'se-apparent'` — opt-in Swiss Ephemeris `swe_houses_ex(SEFLG_SIDEREAL)`
     *     frame: apparent star place (aberration, deflection) plus Δψ.
     *   Defaults to 'jhora', or to 'se-apparent' under the 'modern' profile.
     * @param precision  precision profile and ΔT override. 'modern' also
     *   solves Placidus cusps fully (scheme 'converged').
     */
    public getHouses(
        jd: number,
        lat: number,
        lon: number,
        method = 'W',
        sidereal = true,
        ayanamsaMode?: number,
        ayanamsaOffset = 0,
        siderealFrame?: 'jhora' | 'se-apparent',
        precision?: PrecisionOptions,
    ): HouseData {
        this.checkInit();
        assertJulianDayUt(jd);
        assertLatitude(lat);
        const lonNorm = normalizeLongitude(lon);
        const houseMethod = assertHouseMethod(method);
        assertPrecisionProfile(precision?.precisionProfile);
        assertDeltaTOverrideSeconds(precision?.deltaTOverrideSeconds);
        if (ayanamsaMode !== undefined) assertAyanamsaMode(ayanamsaMode);
        assertFiniteNumber(ayanamsaOffset, 'ayanamsaOffset');
        if (siderealFrame !== undefined) assertSiderealFrame(siderealFrame);
        const ctx = deltaTContextOf(precision);
        if (ctx) {
            return withDeltaTContext(ctx, () =>
                this.housesIn(
                    jd,
                    lat,
                    lonNorm,
                    houseMethod,
                    sidereal,
                    ayanamsaMode,
                    ayanamsaOffset,
                    siderealFrame,
                    precision,
                ),
            );
        }
        return this.housesIn(
            jd,
            lat,
            lonNorm,
            houseMethod,
            sidereal,
            ayanamsaMode,
            ayanamsaOffset,
            siderealFrame,
            precision,
        );
    }

    private tropicalBodyLongitude(
        jd: number,
        bodyId: number,
        lat: number,
        lon: number,
    ): number | undefined {
        const naifId = ID_TO_NAIF[bodyId];
        if (naifId === undefined) return undefined;
        const loc = { latitude: lat, longitude: lon, altitude: 0 };
        return this.meanEclipticOfDate(jd, naifId, GEOMETRIC, loc).lon;
    }

    private housesIn(
        jd: number,
        lat: number,
        lon: number,
        method: string,
        sidereal: boolean,
        ayanamsaMode: number | undefined,
        ayanamsaOffset: number,
        frameArg: 'jhora' | 'se-apparent' | undefined,
        precision?: PrecisionOptions,
    ): HouseData {
        const profile = precision?.precisionProfile;
        const modern = profile === 'modern';
        const siderealFrame = frameArg ?? (modern ? 'se-apparent' : 'jhora');

        const eps = trueObliquity(jd);
        const ramc = mod360(getGAST(jd) + lon);

        const tropAsc = computeAscendant(ramc, lat, eps);
        const tropMC = computeMC(ramc, eps);
        const tropVertex = computeVertex(ramc, lat, eps);

        const letter = method as HouseLetter;
        const houseSystemId = precision?.houseSystemId;
        const anchor = precision?.houseAnchor ?? 'ascendant';
        const cuspsInMiddle = precision?.cuspsInMiddle ?? false;

        let sunLon: number | undefined;
        if (letter === 'I' || letter === 'i') {
            sunLon = this.tropicalBodyLongitude(jd, Body.Sun, lat, lon);
        }
        let moonLon: number | undefined;
        if (anchor === 'moon') {
            moonLon = this.tropicalBodyLongitude(jd, Body.Moon, lat, lon);
        }
        if (anchor === 'sun') {
            sunLon = this.tropicalBodyLongitude(jd, Body.Sun, lat, lon);
        }

        let anchorLon = tropAsc;
        if (anchor === 'aries') anchorLon = 0;
        else if (anchor === 'moon' && moonLon !== undefined) anchorLon = moonLon;
        else if (anchor === 'sun' && sunLon !== undefined) anchorLon = sunLon;

        const tropical = computeTropicalHouses(
            letter,
            ramc,
            lat,
            eps,
            tropAsc,
            tropMC,
            tropVertex,
            {
                placidusScheme: modern ? 'converged' : 'jhora',
                polarFallback: 'porphyry',
                sunEclipticLongitude: sunLon,
            },
        );

        let cusps = tropical.cusps;
        let ascOut = tropical.ascendant;
        const mcOut = tropical.mc;

        if (houseSystemId === 'surya_siddhanta_houses') {
            const sss = sssHouseCusps(ramc, lat, jd, eps);
            cusps = sss.cusps;
            ascOut = sss.ascendant;
        } else if (
            anchor !== 'ascendant' &&
            (letter === 'E' ||
                letter === 'W' ||
                letter === 'D' ||
                letter === 'N' ||
                letter === 'V' ||
                letter === 'A')
        ) {
            cusps = cuspsFromAnchor(anchorLon, letter);
        }

        if (
            cuspsInMiddle &&
            (letter === 'E' ||
                letter === 'A' ||
                letter === 'V' ||
                houseSystemId === 'equal' ||
                houseSystemId === 'vehlow' ||
                houseSystemId === 'nine_pada_equal')
        ) {
            cusps = applyCuspsInMiddle(cusps, tropAsc);
        }

        const build = (sub?: (d: number) => number): HouseData => {
            const map = sub ? (d: number) => sub(d) : (d: number) => d;
            const sidAsc = sub ? sub(tropAsc) : tropAsc;
            let outCusps =
                letter === 'W' && sub ? wholeSignCusps(sidAsc) : sub ? cusps.map(sub) : cusps;
            if (houseSystemId === 'nine_pada_equal') {
                outCusps = ninePadaEqualCusps(sub ? sidAsc : tropAsc);
            }
            return {
                cusps: outCusps,
                ascendant: map(ascOut),
                mc: map(mcOut),
                armc: ramc,
                vertex: map(tropVertex),
                equAsc: tropical.equAsc !== undefined ? map(tropical.equAsc) : undefined,
                coAscKoch: tropical.coAscKoch !== undefined ? map(tropical.coAscKoch) : undefined,
                coAscMunkasey:
                    tropical.coAscMunkasey !== undefined ? map(tropical.coAscMunkasey) : undefined,
                polAsc: tropical.polAsc !== undefined ? map(tropical.polAsc) : undefined,
                gauquelinSectors: tropical.gauquelinSectors?.map(map),
                houseFallback: tropical.fallback,
            };
        };

        if (!sidereal) {
            return build();
        }

        const mode = ayanamsaMode ?? this.ayanamsaMode;
        let ayaEx: number;
        if (siderealFrame === 'se-apparent') {
            const T = julianCenturies(jd + deltaT(jd) / 86400.0);
            ayaEx = computeAyanamsa(mode, jd, 'apparent') + ayanamsaOffset + nutation(T).dpsi;
        } else {
            ayaEx = computeAyanamsa(mode, jd, 'geometric') + ayanamsaOffset;
        }
        const sub = (d: number) => mod360(d - ayaEx);
        return build(sub);
    }

    // -----------------------------------------------------------------------
    // Sidereal time & obliquity — kept for API compatibility
    // -----------------------------------------------------------------------

    /** Greenwich Apparent Sidereal Time in hours. */
    public getSiderealTime(jd: number): number {
        this.checkInit();
        assertJulianDayUt(jd);
        return getGAST(jd) / 15;
    }

    /**
     * Mean obliquity and the IAU 1980 nutation components at `jd`.
     * Previously a two-term nutation approximation good to only ~1″.
     */
    public getEclipticObliquity(jd: number): { eps: number; dpsi: number; deps: number } {
        this.checkInit();
        assertJulianDayUt(jd);
        const jdTT = jd + deltaT(jd) / 86400.0;
        const T = julianCenturies(jdTT);
        const { dpsi, deps } = nutation(T);
        return { eps: meanObliquity(T, jdTT), dpsi, deps };
    }

    /** ΔT = TT − UT in seconds at `jd`, exposed for diagnostics. */
    public getDeltaT(jd: number, precision?: PrecisionOptions): number {
        this.checkInit();
        assertJulianDayUt(jd);
        assertPrecisionProfile(precision?.precisionProfile);
        assertDeltaTOverrideSeconds(precision?.deltaTOverrideSeconds);
        return withDeltaTContext(deltaTContextOf(precision), () => deltaT(jd));
    }

    /** Human-readable label for the active (or given) ayanamsa model. */
    public getAyanamsaName(mode?: number): string {
        return ayanamsaName(mode ?? this.ayanamsaMode);
    }

    /**
     * Topocentric tropical ecliptic (mean equinox of date), geometric or apparent
     * per `positionMode`. Rise/set applies nutation when forming horizontal coords.
     */
    public getTopocentricTropicalEcliptic(
        jdUT: number,
        bodyId: number,
        location: GeoLocation,
        positionMode: PositionMode = DEFAULT_POSITION_MODE,
    ): { lonDeg: number; latDeg: number; distAu: number } {
        this.checkInit();
        const naifId = ID_TO_NAIF[bodyId];
        if (naifId === undefined) {
            throw new Error(`Rise/set does not support body id ${bodyId}`);
        }
        const corrections = correctionsFor(positionMode);
        const ecl = this.meanEclipticOfDate(jdUT, naifId, corrections, location);
        return { lonDeg: ecl.lon, latDeg: ecl.lat, distAu: ecl.dist };
    }

    /**
     * Topocentric equatorial place for rise, set, and culmination.
     *
     * The ecliptic place is the mean equinox of date on the ICRF. Before
     * nutation it is rotated by the IAU 2000 frame bias (IERS Conventions
     * 2010, §5.4.5 and §5.9; dα₀ is eq. 5.21, ξ₀ and η₀ are eq. 5.33),
     * which is the equator the rise/set oracle uses.
     * Chart longitudes are not rotated. Nutation in longitude and the true
     * obliquity then form the true equinox of date. `positionMode` selects
     * the geometric or the apparent place; the bias and nutation apply either
     * way, so a comparison of the two discs is unchanged.
     */
    public getTopocentricEquatorial(
        jdUT: number,
        bodyId: number,
        location: GeoLocation,
        positionMode: PositionMode = DEFAULT_POSITION_MODE,
    ): { raDeg: number; decDeg: number; distAu: number } {
        this.checkInit();
        const naifId = ID_TO_NAIF[bodyId];
        if (naifId === undefined) {
            throw new Error(`Rise/set does not support body id ${bodyId}`);
        }
        const place = this.icrfPlace(jdUT, naifId, correctionsFor(positionMode), location);
        // Bias the ICRF vector itself. Chart latitude is a different cut
        // (longitude left on the ICRF), so round-tripping that mix would
        // apply the bias twice.
        const biased = toSpherical(
            icrfToMeanEclipticOfDate(iau2000FrameBias(place.direction), place.T, place.jdTT),
        );
        const { eps, dpsi, deps } = this.getEclipticObliquity(jdUT);
        const eq = equatorialFromEcliptic(biased.lon + dpsi, biased.lat, eps + deps);
        return { raDeg: eq.raDeg, decDeg: eq.decDeg, distAu: place.dist };
    }

    // -----------------------------------------------------------------------
    // Private
    // -----------------------------------------------------------------------

    private prefetchEphemerisChunks(jdUT: number): void {
        const margin = CHUNK_PREFETCH_MARGIN_DAYS + PLANET_SPEED_STEP_DAYS;
        const jdTdb = jdUT + deltaT(jdUT) / 86_400;
        for (const store of [this.chunkStoreDe441, this.chunkStoreDe431]) {
            if (!store) continue;
            store.prefetchSyncForJdTdb(jdTdb);
            store.prefetchSyncForJdTdb(jdTdb - margin);
            store.prefetchSyncForJdTdb(jdTdb + margin);
        }
    }

    private attachCompositeProvider(): void {
        this.composite = new CompositeEphemerisProvider(this.spk, {
            policy: this.ephemerisPolicy,
            longRangeDe431: this.chunkStoreDe431
                ? { getChunk: this.chunkStoreDe431.asGetter() }
                : undefined,
            longRangeDe441: this.chunkStoreDe441
                ? { getChunk: this.chunkStoreDe441.asGetter() }
                : undefined,
        });
        this.source = this.composite;
    }

    /** Fail fast when a date needs long-range NJCE data that is not resident. */
    private assertLongRangeChunksForJd(jdUT: number): void {
        const jdTdb = jdUT + deltaT(jdUT) / 86_400;
        if (jdTdb >= DE440S_JD_TDB_START && jdTdb <= DE440S_JD_TDB_END) {
            return;
        }
        const store = this.chunkStoreDe441 ?? this.chunkStoreDe431;
        if (!store) {
            throw new NodeJHoraError(
                NodeJHoraErrorCode.EPHEMERIS_UNAVAILABLE,
                `Julian Day (UT) ${jdUT} is outside DE440s coverage (JD(TDB) ${DE440S_JD_TDB_START}–${DE440S_JD_TDB_END}). ` +
                    'Attach DE441 or DE431 NJCE chunks with setDe441ChunkStore() / setChunkStore() before calculating ancient or far-future dates.',
                { jd: jdUT, jdTdb },
            );
        }
        const cent = centuryIndex(jdTdbToAstronomicalYear(jdTdb));
        const hasChunk = (groupId: number): boolean => {
            for (const c of [cent - 1, cent, cent + 1]) {
                if (store.get(c, groupId)) return true;
            }
            return false;
        };
        const kernel = this.chunkStoreDe441 ? 'DE441' : 'DE431';
        if (!hasChunk(0) || !hasChunk(1)) {
            throw new NodeJHoraError(
                NodeJHoraErrorCode.EPHEMERIS_UNAVAILABLE,
                `${kernel} NJCE chunks for century ${cent} (and neighbours) are not loaded. ` +
                    `Prefetch or install the matching @node-jhora/ephe-de441-* or ephe-de431-* data package.`,
                { jd: jdUT, jdTdb, century: cent },
            );
        }
    }

    private checkInit(): void {
        if (!this.initialized) assertNotInitialized();
    }
}
