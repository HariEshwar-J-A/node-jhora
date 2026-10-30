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
 *                                  (IERS 2010 eq. 5.16; ADR 0008)
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
    meanLunarNode,
    setStarKinematicsProvider,
    toSidereal,
} from './ayanamsa.js';
import { getBspBytesLoader } from './bsp-bytes-provider.js';
import {
    computeAscendant,
    computeMC,
    computeVertex,
    equalHouseCusps,
    getGAST,
    julianCenturies,
    meanObliquity,
    mod360,
    observerGeocentricVector,
    placidusCusps,
    porphyryCusps,
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
    APPARENT_SPEED_STEP_DAYS,
    geocentricRelativeState,
    isGeometricPlace,
    meanEclipticRelativeKinematics,
    sphericalRatesDegPerDay,
} from './kinematics.js';
import { trueAscendingNodeLongitude } from './lunar-node.js';
import { nutation } from './nutation.js';
import {
    chartEclipticFromIcrfDirection,
    icrfToMeanEclipticOfDate,
    type Vec,
} from './precession.js';
import { centuryIndex, jdTdbToAstronomicalYear } from './provider/de431-chunk.js';
import { DE440S_JD_TDB_END, DE440S_JD_TDB_START } from './provider/de440s.js';
import {
    CompositeEphemerisProvider,
    type De431ChunkStore,
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
};

/** Bodies drawn from the SPK file, in the order they are reported. */
const SPK_BODY_IDS = [
    Body.Sun,
    Body.Moon,
    Body.Mercury,
    Body.Venus,
    Body.Mars,
    Body.Jupiter,
    Body.Saturn,
] as const;

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

// ---------------------------------------------------------------------------
// EphemerisEngine
// ---------------------------------------------------------------------------

export class EphemerisEngine {
    private static instance: EphemerisEngine;
    private initialized = false;

    private spk!: SpkFile;
    private source!: BarycentricSource;
    private composite!: CompositeEphemerisProvider;
    private chunkStore?: De431ChunkStore;
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
     * Attach a DE431 chunk store (browser loader or Node filesystem cache).
     * Call before {@link initialize} when long-range dates are needed.
     */
    public setChunkStore(store: De431ChunkStore): void {
        this.chunkStore = store;
        if (this.initialized) {
            this.attachCompositeProvider();
        }
    }

    /** Force DE440s, DE431 long-range, or auto (default). */
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
        const ayan = computeAyanamsa(effectiveMode, jd, frame) + ayanamsaOffset;
        const precisionProfile = options.precisionProfile ?? getDeltaTContext().profile;
        // Sidereal longitudes subtract ayanamsa; speeds follow oracle SP-B2:
        // `jhora` reports tropical TRUEPOS rate (≈ d(tropical)/dt); sidereal FD is
        // lower by d(ayan)/dt (~0.138″/day). `modern` reports sidereal rate =
        // tropical − d(ayan)/dt (geometric True Citra, same 1 s step on ayanamsa).
        const ayanRateForSiderealSpeed =
            precisionProfile === 'modern'
                ? this.ayanamsaRateDegPerDay(jd, effectiveMode, 'geometric', ayanamsaOffset)
                : 0;

        const planets: PlanetPosition[] = [];

        for (const pid of SPK_BODY_IDS) {
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
        const node = this.lunarNode(jd, nodeType, precisionProfile);
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
        const T = julianCenturies(jdTT);
        const ecl = chartEclipticFromIcrfDirection(place.direction as Vec, T, jdTT);

        return { lon: ecl.lon, lat: ecl.lat, dist: place.distanceAU };
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
    ): {
        lon: number;
        dist: number;
        speed: number;
    } {
        const T = julianCenturies(jdUT + deltaT(jdUT) / 86400.0);

        if (nodeType === 'mean') {
            // Mean regression: −360° per 6798.38 days (18.6-year nodal cycle).
            const speed = -1934.1362891 / 36525.0;
            return { lon: meanLunarNode(T), dist: 0.002569, speed };
        }

        const lon = this.trueNodeLongitude(jdUT, precisionProfile);
        const h = APPARENT_SPEED_STEP_DAYS;
        let d =
            this.trueNodeLongitude(jdUT + h, precisionProfile) -
            this.trueNodeLongitude(jdUT - h, precisionProfile);
        if (d > 180) d -= 360;
        if (d < -180) d += 360;

        return { lon, dist: 0.002569, speed: d / (2 * h) };
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

    /**
     * True (osculating) lunar node: the ascending intersection of the Moon's
     * instantaneous orbital plane with the ecliptic.
     *
     * Derived from the geocentric position and velocity of the Moon — the
     * orbital angular momentum vector h = r × v is normal to the orbit plane, so
     * the ascending node lies along ẑ × h.
     */
    private trueNodeLongitude(jdUT: number, profile: PrecisionProfile): number {
        const source = {
            getBarycentric: (naifBody: number, et: number) =>
                this.composite.getBarycentricForLunarNode(naifBody, et, profile),
        };
        // Black-box (modern + JHora DLL oracles): best match omits ∂(ecliptic frame)/∂t on
        // velocity (~0.26″ offset vs spin=true). Moon daily motion still uses full spin in
        // meanEclipticRelativeKinematics. See tests/engine/true-node-frame-probe.test.ts.
        return trueAscendingNodeLongitude(jdUT, source, {
            eclipticFrame: 'mean_ecliptic_of_date',
            velocityMode: 'spk_analytic',
            precessionSpin: false,
        });
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
                    precision?.precisionProfile,
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
            precision?.precisionProfile,
        );
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
        profile: PrecisionProfile | undefined,
    ): HouseData {
        const modern = profile === 'modern';
        const siderealFrame = frameArg ?? (modern ? 'se-apparent' : 'jhora');

        // Angles are built on apparent sidereal time and the true obliquity,
        // as swe_houses does. Whole Sign cusps are the sign boundaries of the
        // sidereal ascendant, not the tropical cusps shifted by ayanamsa.
        const eps = trueObliquity(jd);
        const ramc = mod360(getGAST(jd) + lon);

        const tropAsc = computeAscendant(ramc, lat, eps);
        const tropMC = computeMC(ramc, eps);
        const tropVertex = computeVertex(ramc, lat, eps);

        const tropicalCusps = (): number[] => {
            if (method === 'E') return equalHouseCusps(tropAsc);
            // Placidus is undefined beyond the polar circle; like swe_houses
            // (SE general documentation §6.4) fall back to Porphyry there.
            if (method === 'P') {
                return Math.abs(lat) >= 90 - eps
                    ? porphyryCusps(tropAsc, tropMC)
                    : placidusCusps(
                          ramc,
                          lat,
                          eps,
                          tropAsc,
                          tropMC,
                          modern ? 'converged' : 'jhora',
                      );
            }
            if (method === 'O') return porphyryCusps(tropAsc, tropMC);
            return wholeSignCusps(tropAsc);
        };

        if (!sidereal) {
            return {
                cusps: tropicalCusps(),
                ascendant: tropAsc,
                mc: tropMC,
                armc: ramc,
                vertex: tropVertex,
            };
        }

        const mode = ayanamsaMode ?? this.ayanamsaMode;
        let ayaEx: number;
        if (siderealFrame === 'se-apparent') {
            // aya_ex = apparent ayanamsa (no nutation) + Δψ, the value
            // swe_get_ayanamsa_ex_ut reports for a star-defined mode.
            const T = julianCenturies(jd + deltaT(jd) / 86400.0);
            ayaEx = computeAyanamsa(mode, jd, 'apparent') + ayanamsaOffset + nutation(T).dpsi;
        } else {
            ayaEx = computeAyanamsa(mode, jd, 'geometric') + ayanamsaOffset;
        }
        const sub = (d: number) => mod360(d - ayaEx);
        const sidAsc = sub(tropAsc);

        return {
            cusps: method === 'W' ? wholeSignCusps(sidAsc) : tropicalCusps().map(sub),
            ascendant: sidAsc,
            mc: sub(tropMC),
            armc: ramc,
            vertex: sub(tropVertex),
        };
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

    // -----------------------------------------------------------------------
    // Private
    // -----------------------------------------------------------------------

    private prefetchEphemerisChunks(jdUT: number): void {
        if (!this.chunkStore) return;
        const margin = CHUNK_PREFETCH_MARGIN_DAYS + PLANET_SPEED_STEP_DAYS;
        const jdTdb = jdUT + deltaT(jdUT) / 86_400;
        this.chunkStore.prefetchSyncForJdTdb(jdTdb);
        this.chunkStore.prefetchSyncForJdTdb(jdTdb - margin);
        this.chunkStore.prefetchSyncForJdTdb(jdTdb + margin);
    }

    private attachCompositeProvider(): void {
        this.composite = new CompositeEphemerisProvider(this.spk, {
            policy: this.ephemerisPolicy,
            longRange: this.chunkStore ? { getChunk: this.chunkStore.asGetter() } : undefined,
        });
        this.source = this.composite;
    }

    /**
     * Fail fast when a date needs DE431 NJCE data that is not resident (instead
     * of letting the SPK reader throw RangeError or returning wrong positions).
     */
    private assertLongRangeChunksForJd(jdUT: number): void {
        const jdTdb = jdUT + deltaT(jdUT) / 86_400;
        if (jdTdb >= DE440S_JD_TDB_START && jdTdb <= DE440S_JD_TDB_END) {
            return;
        }
        if (!this.chunkStore) {
            throw new NodeJHoraError(
                NodeJHoraErrorCode.EPHEMERIS_UNAVAILABLE,
                `Julian Day (UT) ${jdUT} is outside DE440s coverage (JD(TDB) ${DE440S_JD_TDB_START}–${DE440S_JD_TDB_END}). ` +
                    'Attach DE431 NJCE chunks with setChunkStore() before calculating ancient or far-future dates.',
                { jd: jdUT, jdTdb },
            );
        }
        const cent = centuryIndex(jdTdbToAstronomicalYear(jdTdb));
        const hasChunk = (groupId: number): boolean => {
            for (const c of [cent - 1, cent, cent + 1]) {
                if (this.chunkStore!.get(c, groupId)) return true;
            }
            return false;
        };
        if (!hasChunk(0) || !hasChunk(1)) {
            throw new NodeJHoraError(
                NodeJHoraErrorCode.EPHEMERIS_UNAVAILABLE,
                `DE431 NJCE chunks for century ${cent} (and neighbours) are not loaded. ` +
                    'Prefetch or install the matching @node-jhora/ephe-de431-* data package.',
                { jd: jdUT, jdTdb, century: cent },
            );
        }
    }

    private checkInit(): void {
        if (!this.initialized) assertNotInitialized();
    }
}
