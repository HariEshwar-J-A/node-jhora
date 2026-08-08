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
 * Tropical apparent longitude vs JPL Horizons, all bodies:
 *   1900 · 1970 · 1998 · 2024   ≤ 0.28″   (typically 0.04″)
 *   2100                        ≤ 46″     — entirely the ΔT forecast gap;
 *                                           Horizons freezes ΔT, this engine
 *                                           extrapolates it
 * Sidereal zero point vs JHora, 1998 reference chart:
 *   True Pushya   0.03″   derived from δ Cancri, no fitted constant
 *   Moon          1.0″
 *   Ascendant    24″      within the ~13″ that UT1−UTC alone can shift it
 *
 * See tests/golden/horizons.golden.test.ts and jhora-bridge.golden.test.ts.
 *
 * ── Coordinate chain ─────────────────────────────────────────────────────
 * 1. jdUTtoET(jd)                  UT → TT → ephemeris seconds (applies ΔT)
 * 2. observerState()               Earth barycentric state, plus the observer's
 *                                  geocentric vector when topocentric
 * 3. apparentPlace()               light-time (iterated), solar deflection,
 *                                  relativistic aberration → ICRF direction
 * 4. icrfToMeanEclipticOfDate()    IAU 2006 precession rotation + mean obliquity
 * 5. toSidereal(lon, ayanamsa)     sidereal longitude
 *
 * Nutation is applied to the *angles* (via apparent sidereal time and true
 * obliquity) but not to planetary longitudes: ayanamsa is referred to the mean
 * equinox of date, so adding nutation there would double-count it.
 *
 * ── Data source ──────────────────────────────────────────────────────────
 * de440s.bsp   Coverage: 1849-12-26 to 2150-01-22  (~32 MB)
 * Downloaded from JPL by @node-jhora/ephe postinstall.
 * https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de440s.bsp
 */

import { DateTime }          from 'luxon';
import { loadSpk, NAIF }     from './spk.js';
import type { SpkFile }      from './spk.js';
import {
    julday as juldayFn,
    julianCenturies,
    meanObliquity,
    trueObliquity,
    getGAST,
    computeAscendant,
    computeMC,
    computeVertex,
    wholeSignCusps,
    equalHouseCusps,
    observerGeocentricVector,
    mod360,
} from './coordinates.js';
import { deltaT, jdUTtoET }  from './deltat.js';
import { nutation }          from './nutation.js';
import {
    icrfToMeanEclipticOfDate,
    toSpherical,
    type Vec,
} from './precession.js';
import {
    computePlace, observerState,
    GEOMETRIC, APPARENT,
    type PlaceCorrections,
} from './apparent.js';
import {
    getAyanamsa as computeAyanamsa,
    ayanamsaName,
    meanLunarNode,
    toSidereal,
} from './ayanamsa.js';

// ---------------------------------------------------------------------------
// Ayanamsa constants — identical to previous version for API compatibility
// ---------------------------------------------------------------------------

export const AYANAMSA = {
    FAGAN_BRADLEY:   0,
    /** Lahiri as JHora reports it (see AYANAMSA_MODELS note). */
    LAHIRI:          1,
    /** Lahiri per the Indian Calendar Reform Committee definition. */
    LAHIRI_ICRC:     2,
    RAMAN:           3,
    KRISHNAMURTI:    5,
    YUKTESHWAR:      7,
    JN_BHASIN:       8,
    J2000:          18,
    /** True Chitrapaksha — Spica pinned to 180°. The project's reference model. */
    TRUE_CITRA:     27,
    TRUE_PUSHYA:    29,
    TRUE_REVATI:    30,
    TRUE_MULA:      35,
} as const;

/**
 * Default sidereal zero point: True Chitrapaksha with Drik Siddhanta.
 * Unlike the epoch-anchored models it needs no fitted constant — it is derived
 * from Spica's computed position, so it is exact at every date.
 */
export const DEFAULT_AYANAMSA: number = AYANAMSA.TRUE_CITRA;

export type AyanamsaMode = typeof AYANAMSA[keyof typeof AYANAMSA];

// ---------------------------------------------------------------------------
// Public types — identical to previous version
// ---------------------------------------------------------------------------

export interface GeoLocation {
    latitude:  number;
    longitude: number;
    altitude?: number;
}

export interface PlanetPosition {
    id:          number;
    name:        string;
    longitude:   number;   // Sidereal [0, 360)
    latitude:    number;   // Ecliptic latitude (degrees)
    distance:    number;   // AU
    speed:       number;   // Degrees per day (negative = retrograde)
    declination: number;   // Equatorial declination (degrees)
}

export interface HouseData {
    cusps:     number[];   // 12 elements, H1 start … H12 start (sidereal)
    ascendant: number;     // Sidereal ascendant (degrees)
    mc:        number;     // Sidereal MC (degrees)
    armc:      number;     // RAMC = Right Ascension of Midheaven (degrees)
    vertex:    number;     // Sidereal vertex (degrees)
}

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

const PLANET_NAMES: Record<number, string> = {
    0: 'Sun', 1: 'Moon', 2: 'Mercury', 3: 'Venus',
    4: 'Mars', 5: 'Jupiter', 6: 'Saturn', 10: 'Rahu', 99: 'Ketu',
};

/** Our internal planet IDs → NAIF body IDs in de440s.bsp */
const ID_TO_NAIF: Record<number, number> = {
    0: NAIF.Sun,
    1: NAIF.Moon,
    2: NAIF.Mercury,
    3: NAIF.Venus,
    4: NAIF.Mars,
    5: NAIF.Jupiter,
    6: NAIF.Saturn,
};

/** Bodies drawn from the SPK file, in the order they are reported. */
const SPK_BODY_IDS = [0, 1, 2, 3, 4, 5, 6] as const;

/** Half-step used for the central difference that yields daily motion, in days. */
const SPEED_STEP_DAYS = 0.25;

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
    private initialized     = false;

    private spk!:         SpkFile;
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
     * Load de440s.bsp from @node-jhora/ephe (or NODE_JHORA_EPHE_PATH env var).
     * Idempotent — subsequent calls are instant no-ops.
     */
    public async initialize(): Promise<void> {
        if (this.initialized) return;

        const bspPath    = await this.resolveBspPath();
        this.spk         = loadSpk(bspPath);
        this.initialized = true;
    }

    private async resolveEphePath(): Promise<string> {
        return this.resolveBspPath();
    }

    private async resolveBspPath(): Promise<string> {
        // 1. Environment variable override
        if (process.env.NODE_JHORA_EPHE_PATH) {
            return process.env.NODE_JHORA_EPHE_PATH;
        }

        const { existsSync }    = await import('fs');
        const { join, dirname } = await import('path');

        // 2. @node-jhora/ephe package (primary path)
        try {
            const { createRequire } = await import('module');
            const req       = createRequire(import.meta.url);
            const pkgJson   = req.resolve('@node-jhora/ephe/package.json');
            const candidate = join(dirname(pkgJson), 'de440s.bsp');
            if (existsSync(candidate)) return candidate;
        } catch (_) { /* package not installed */ }

        // 3. Dev fallback — look for de440s.bsp next to the packages/ dir
        const devCandidate = new URL('../../../../de440s.bsp', import.meta.url);
        const devPath = devCandidate.pathname.replace(/^\/([A-Z]:)/, '$1'); // Windows fix
        if (existsSync(devPath)) return devPath;

        throw new Error(
            'EphemerisEngine: de440s.bsp not found.\n' +
            '  Install the data package:  npm install @node-jhora/ephe\n' +
            '  Or set:  NODE_JHORA_EPHE_PATH=/path/to/de440s.bsp',
        );
    }

    // -----------------------------------------------------------------------
    // Configuration
    // -----------------------------------------------------------------------

    /** Set ayanamsa mode. Accepts AYANAMSA.* constants. */
    public setAyanamsa(mode: number): void {
        this.checkInit();
        this.ayanamsaMode = mode;
    }

    // -----------------------------------------------------------------------
    // Julian Day
    // -----------------------------------------------------------------------

    /** Compute Julian Day (UT) for any Luxon DateTime. */
    public julday(date: DateTime): number {
        this.checkInit();
        const u = date.toUTC();
        return juldayFn(u.year, u.month, u.day, u.hour + u.minute / 60 + u.second / 3600);
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
     */
    public getAyanamsa(jd: number, mode?: number, offsetDeg = 0): number {
        this.checkInit();
        return computeAyanamsa(mode ?? this.ayanamsaMode, jd) + offsetDeg;
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
        date:     DateTime,
        location?: GeoLocation,
        options: {
            ayanamsaOrder?: number;
            topocentric?:   boolean;
            nodeType?:      'mean' | 'true';
            positionMode?:  PositionMode;
            /** Constant added to the ayanamsa, degrees. */
            ayanamsaOffset?: number;
        } = {},
    ): PlanetPosition[] {
        this.checkInit();

        const {
            ayanamsaOrder,
            topocentric  = false,
            nodeType     = DEFAULT_NODE_TYPE,
            positionMode = DEFAULT_POSITION_MODE,
            ayanamsaOffset = 0,
        } = options;
        const effectiveMode = ayanamsaOrder ?? this.ayanamsaMode;
        const corrections   = correctionsFor(positionMode);

        const jd   = this.julday(date);
        const ayan = computeAyanamsa(effectiveMode, jd) + ayanamsaOffset;

        const planets: PlanetPosition[] = [];

        for (const pid of SPK_BODY_IDS) {
            const naifId = ID_TO_NAIF[pid];

            const loc    = topocentric ? location : undefined;
            const here   = this.meanEclipticOfDate(jd, naifId, corrections, loc);
            // Daily motion by central difference on the final longitude, so
            // retrogression reflects the motion actually being reported.
            const before = this.meanEclipticOfDate(jd - SPEED_STEP_DAYS, naifId, corrections, loc);
            const after  = this.meanEclipticOfDate(jd + SPEED_STEP_DAYS, naifId, corrections, loc);

            let dLon = after.lon - before.lon;
            if (dLon >  180) dLon -= 360;
            if (dLon < -180) dLon += 360;

            planets.push({
                id: pid,
                name:        PLANET_NAMES[pid] ?? `P${pid}`,
                longitude:   toSidereal(here.lon, ayan),
                latitude:    here.lat,
                distance:    here.dist,
                speed:       dLon / (2 * SPEED_STEP_DAYS),
                declination: this.declinationOf(jd, here.lon, here.lat),
            });
        }

        // ── Lunar nodes ─────────────────────────────────────────────────────
        const node = this.lunarNode(jd, nodeType);
        planets.push({
            id: 10, name: 'Rahu',
            longitude:   toSidereal(node.lon, ayan),
            latitude:    0,
            distance:    node.dist,
            speed:       node.speed,
            declination: this.declinationOf(jd, node.lon, 0),
        });

        const rahu = planets[planets.length - 1];
        planets.push({
            id: 99, name: 'Ketu',
            longitude:   mod360(rahu.longitude + 180),
            latitude:    0,
            distance:    rahu.distance,
            speed:       rahu.speed,
            declination: -rahu.declination,
        });

        return planets;
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
            ? observerGeocentricVector(jdUT, location.latitude, location.longitude, location.altitude ?? 0)
            : undefined;

        const observer = observerState(this.spk, NAIF.Earth, et, offset);
        const place    = computePlace(this.spk, naifId, NAIF.Sun, et, observer, corrections);

        const T   = julianCenturies(jdUT + deltaT(jdUT) / 86400.0);
        const ecl = toSpherical(icrfToMeanEclipticOfDate(place.direction as Vec, T));

        return { lon: ecl.lon, lat: ecl.lat, dist: place.distanceAU };
    }

    /**
     * Mean or true (osculating) longitude of the Moon's ascending node,
     * tropical degrees in the mean ecliptic of date.
     *
     * The `nodeType` option was previously accepted and silently ignored, so
     * requesting true nodes returned mean ones.
     */
    private lunarNode(jdUT: number, nodeType: 'mean' | 'true'): {
        lon: number; dist: number; speed: number;
    } {
        const T = julianCenturies(jdUT + deltaT(jdUT) / 86400.0);

        if (nodeType === 'mean') {
            // Mean regression: −360° per 6798.38 days (18.6-year nodal cycle).
            const speed = -1934.1362891 / 36525.0;
            return { lon: meanLunarNode(T), dist: 0.002569, speed };
        }

        const lon = this.trueNodeLongitude(jdUT);
        const h   = 0.25;
        let d = this.trueNodeLongitude(jdUT + h) - this.trueNodeLongitude(jdUT - h);
        if (d >  180) d -= 360;
        if (d < -180) d += 360;

        return { lon, dist: 0.002569, speed: d / (2 * h) };
    }

    /**
     * True (osculating) lunar node: the ascending intersection of the Moon's
     * instantaneous orbital plane with the ecliptic.
     *
     * Derived from the geocentric position and velocity of the Moon — the
     * orbital angular momentum vector h = r × v is normal to the orbit plane, so
     * the ascending node lies along ẑ × h.
     */
    private trueNodeLongitude(jdUT: number): number {
        const et = jdUTtoET(jdUT);
        const T  = julianCenturies(jdUT + deltaT(jdUT) / 86400.0);

        const moon  = this.spk.getBarycentric(NAIF.Moon,  et);
        const earth = this.spk.getBarycentric(NAIF.Earth, et);

        const r: Vec = [moon.x - earth.x, moon.y - earth.y, moon.z - earth.z];
        const v: Vec = [moon.vx - earth.vx, moon.vy - earth.vy, moon.vz - earth.vz];

        // Work in the ecliptic of date so that "ecliptic plane" means z = 0.
        const rEcl = icrfToMeanEclipticOfDate(r, T);
        const vEcl = icrfToMeanEclipticOfDate(v, T);

        // h = r × v  (normal to the orbit plane)
        const hx = rEcl[1] * vEcl[2] - rEcl[2] * vEcl[1];
        const hy = rEcl[2] * vEcl[0] - rEcl[0] * vEcl[2];

        // Ascending node direction = ẑ × h = (−h_y, h_x, 0)
        return mod360(Math.atan2(hx, -hy) * 180 / Math.PI);
    }

    /** Equatorial declination from mean-of-date ecliptic longitude and latitude. */
    private declinationOf(jdUT: number, lon: number, lat: number): number {
        const T   = julianCenturies(jdUT + deltaT(jdUT) / 86400.0);
        const eps = meanObliquity(T) * Math.PI / 180;
        const l   = lon * Math.PI / 180;
        const b   = lat * Math.PI / 180;
        return Math.asin(
            Math.sin(b) * Math.cos(eps) + Math.cos(b) * Math.sin(eps) * Math.sin(l),
        ) * 180 / Math.PI;
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
     * @param method   'W' = Whole Sign (default); others treated as Whole Sign
     * @param sidereal When true (default), all angles have ayanamsa subtracted
     */
    public getHouses(
        jd: number, lat: number, lon: number,
        method = 'W', sidereal = true, ayanamsaMode?: number, ayanamsaOffset = 0,
    ): HouseData {
        this.checkInit();

        // The angles are Earth-rotation quantities, so they are built on
        // *apparent* sidereal time and the *true* obliquity — unlike planetary
        // longitudes, which stop at the mean equinox. Subtracting the ayanamsa
        // afterwards then reproduces Swiss Ephemeris' sidereal house behaviour.
        const eps  = trueObliquity(jd);
        const ramc = mod360(getGAST(jd) + lon);

        const tropAsc    = computeAscendant(ramc, lat, eps);
        const tropMC     = computeMC(ramc, eps);
        const tropVertex = computeVertex(ramc, lat, eps);

        const cuspsFor = (asc: number) =>
            method === 'E' ? equalHouseCusps(asc) : wholeSignCusps(asc);

        if (sidereal) {
            const ayan = computeAyanamsa(ayanamsaMode ?? this.ayanamsaMode, jd) + ayanamsaOffset;
            const sub  = (d: number) => mod360(d - ayan);
            const sidAsc = sub(tropAsc);
            return {
                cusps:     cuspsFor(sidAsc),
                ascendant: sidAsc,
                mc:        sub(tropMC),
                armc:      ramc,
                vertex:    sub(tropVertex),
            };
        }

        return {
            cusps:     cuspsFor(tropAsc),
            ascendant: tropAsc,
            mc:        tropMC,
            armc:      ramc,
            vertex:    tropVertex,
        };
    }

    // -----------------------------------------------------------------------
    // Sidereal time & obliquity — kept for API compatibility
    // -----------------------------------------------------------------------

    /** Greenwich Apparent Sidereal Time in hours. */
    public getSiderealTime(jd: number): number {
        this.checkInit();
        return getGAST(jd) / 15;
    }

    /**
     * Mean obliquity and the IAU 1980 nutation components at `jd`.
     * Previously a two-term nutation approximation good to only ~1″.
     */
    public getEclipticObliquity(jd: number): { eps: number; dpsi: number; deps: number } {
        this.checkInit();
        const T = julianCenturies(jd + deltaT(jd) / 86400.0);
        const { dpsi, deps } = nutation(T);
        return { eps: meanObliquity(T), dpsi, deps };
    }

    /** ΔT = TT − UT in seconds at `jd`, exposed for diagnostics. */
    public getDeltaT(jd: number): number {
        this.checkInit();
        return deltaT(jd);
    }

    /** Human-readable label for the active (or given) ayanamsa model. */
    public getAyanamsaName(mode?: number): string {
        return ayanamsaName(mode ?? this.ayanamsaMode);
    }

    // -----------------------------------------------------------------------
    // Private
    // -----------------------------------------------------------------------

    private checkInit(): void {
        if (!this.initialized) {
            throw new Error(
                'EphemerisEngine not initialised — call `await engine.initialize()` first.',
            );
        }
    }
}
