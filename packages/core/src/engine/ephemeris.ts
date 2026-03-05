import { DateTime } from 'luxon';
import { normalize360 } from '../core/math.js';
import { calculateParallax } from '../core/astronomy.js';
// @ts-ignore - swisseph-wasm does not ship TypeScript types
import swisseph from 'swisseph-wasm';

// ---------------------------------------------------------------------------
// Ayanamsa constants (Swiss Ephemeris SE_SIDM_* codes)
// ---------------------------------------------------------------------------

export const AYANAMSA = {
    LAHIRI:          1,   // SE_SIDM_LAHIRI — Vedic Standard
    DELUCE:          2,
    RAMAN:           3,
    KRISHNAMURTI:    5,
    YUKTESHWAR:      7,
    JN_BHASIN:       8,
    BABYL_KUGLER1:  14,
    TRUE_PUSHYA:    29,   // SE_SIDM_TRUE_PUSHYA — Krishnamurti with true node
    GALACTIC_CTR:   28,
} as const;

export type AyanamsaMode = typeof AYANAMSA[keyof typeof AYANAMSA];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GeoLocation {
    latitude:   number;
    longitude:  number;
    altitude?:  number; // metres ASL
}

export interface PlanetPosition {
    id:          number;
    name:        string;
    longitude:   number; // Sidereal 0-360°
    latitude:    number; // Ecliptic latitude
    distance:    number; // AU
    speed:       number; // degrees per day (negative = retrograde)
    declination: number; // Equatorial latitude
}

export interface HouseData {
    cusps:     number[]; // indices 0-11 (H1 start … H12 start)
    ascendant: number;
    mc:        number;
    armc:      number;
    vertex:    number;
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

export class EphemerisEngine {
    private static instance: EphemerisEngine;
    private initialized: boolean = false;
    private module: any; // swisseph-wasm WASM module

    public constructor() {}

    /** Singleton accessor (optional — callers may also construct directly). */
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
     * Initialise the WASM module.
     * MUST be called before any calculation method.
     */
    public async initialize(): Promise<void> {
        if (this.initialized) return;

        // @ts-ignore
        this.module = new swisseph();

        if (this.module.initSwissEph) {
            await this.module.initSwissEph();
        }

        // Browser: load ephemeris files into WASM MemFS
        if (typeof window !== 'undefined' && typeof fetch === 'function') {
            await this.loadEphemerisFiles('/ephe/');
        }

        this.initialized = true;
    }

    private async loadEphemerisFiles(baseUrl: string): Promise<void> {
        const files = ['sepl_18.se1', 'semo_18.se1', 'seas_18.se1'];

        // @ts-ignore
        const Swe = this.module.SweModule || this.module;
        // @ts-ignore
        const FS  = Swe.FS || this.module.FS;
        if (!FS) {
            console.warn('SwissEph WASM FS not available — skipping file load');
            return;
        }

        try {
            try { FS.mkdir('/ephe'); } catch (_) { /* already exists */ }

            for (const file of files) {
                try {
                    const res = await fetch(`${baseUrl}${file}`);
                    if (res.ok) {
                        const data = new Uint8Array(await res.arrayBuffer());
                        FS.createDataFile('/ephe', file, data, true, true, true);
                    } else {
                        console.warn(`SwissEph: failed to fetch ${file}: ${res.statusText}`);
                    }
                } catch (e) {
                    console.warn(`SwissEph: error loading ${file}`, e);
                }
            }

            if (Swe.ccall) {
                Swe.ccall('swe_set_ephe_path', null, ['string'], ['/ephe']);
            }
        } catch (e) {
            console.error('SwissEph: failed to load ephemeris files', e);
        }
    }

    // -----------------------------------------------------------------------
    // Configuration
    // -----------------------------------------------------------------------

    /**
     * Set Ayanamsa mode. Use AYANAMSA constants.
     * Default is LAHIRI (1) — Vedic standard.
     */
    public setAyanamsa(mode: number): void {
        this.checkInit();
        this.module.set_sid_mode(mode, 0, 0);
    }

    // -----------------------------------------------------------------------
    // Julian Day
    // -----------------------------------------------------------------------

    /**
     * Compute Julian Day Number (UT) for a given Luxon DateTime.
     * Always converts to UTC before computing.
     */
    public julday(date: DateTime): number {
        this.checkInit();
        const utc = date.toUTC();
        return this.module.julday(
            utc.year, utc.month, utc.day,
            utc.hour + utc.minute / 60 + utc.second / 3600,
            this.module.SE_GREG_CAL,
        );
    }

    // -----------------------------------------------------------------------
    // Ayanamsa
    // -----------------------------------------------------------------------

    /**
     * Returns the current Ayanamsa value (in degrees) for a given Julian Day.
     * Calls Swiss Ephemeris `swe_get_ayanamsa_ut()` via ccall.
     */
    public getAyanamsa(julday: number): number {
        this.checkInit();
        // @ts-ignore
        const Swe = this.module.SweModule || this.module;

        if (Swe.ccall) {
            // swe_get_ayanamsa_ut(tjd_ut) returns double directly
            return Swe.ccall('swe_get_ayanamsa_ut', 'number', ['number'], [julday]) as number;
        }

        // Fallback: use the JS wrapper if available
        if (typeof this.module.get_ayanamsa_ut === 'function') {
            return this.module.get_ayanamsa_ut(julday) as number;
        }

        console.warn('getAyanamsa: swe_get_ayanamsa_ut not available');
        return NaN;
    }

    // -----------------------------------------------------------------------
    // Planets
    // -----------------------------------------------------------------------

    /**
     * Compute sidereal planetary positions for a given date.
     *
     * @param date        Luxon DateTime (any timezone — converted to UTC internally)
     * @param location    Observer location (used for topocentric Moon correction)
     * @param options     Calculation flags
     */
    public getPlanets(
        date:      DateTime,
        location?: GeoLocation,
        options:   {
            ayanamsaOrder?: number;
            topocentric?:   boolean;
            nodeType?:      'mean' | 'true';
        } = {},
    ): PlanetPosition[] {
        this.checkInit();

        // @ts-ignore
        const Swe = this.module.SweModule || this.module;
        const { ayanamsaOrder, topocentric = false, nodeType = 'mean' } = options;

        if (ayanamsaOrder !== undefined) {
            this.setAyanamsa(ayanamsaOrder);
        }

        const utc = date.toUTC();
        const jd  = this.module.julday(
            utc.year, utc.month, utc.day,
            utc.hour + utc.minute / 60 + utc.second / 3600,
            this.module.SE_GREG_CAL,
        );

        // Obliquity and LST for topocentric corrections
        let obl = 23.44;
        let lst  = 0;
        if (topocentric) {
            const oblData = this.getEclipticObliquity(jd);
            obl = oblData.eps + oblData.deps;
            if (location) {
                const gmst   = this.getSiderealTime(jd);
                const lonHrs = location.longitude / 15;
                lst = normalize360((gmst + lonHrs) * 15);
            }
        }

        // Planet body IDs (SE convention)
        // 0=Sun, 1=Moon, 2=Mercury, 3=Venus, 4=Mars, 5=Jupiter, 6=Saturn
        // 10=SE_MEAN_NODE (Mean Node / Rahu), 11=SE_TRUE_NODE (True Node / Rahu)
        const planetIds = [0, 1, 2, 3, 4, 5, 6];
        planetIds.push(nodeType === 'true' ? 11 : 10);

        // Pre-allocate 6-double buffer (48 bytes) once and reuse
        // @ts-ignore
        const buffer = Swe._malloc(6 * 8);
        const planets: PlanetPosition[] = [];

        try {
            for (const pid of planetIds) {
                const flags = this.module.SEFLG_SWIEPH | this.module.SEFLG_SIDEREAL |
                              this.module.SEFLG_TRUEPOS | this.module.SEFLG_NONUT | this.module.SEFLG_SPEED;

                Swe.ccall(
                    'swe_calc_ut', 'number',
                    ['number', 'number', 'number', 'pointer', 'pointer'],
                    [jd, pid, flags, buffer, null],
                );

                // @ts-ignore — HEAPF64 is the typed array view of WASM memory
                const lon   = Swe.HEAPF64[buffer / 8 + 0];
                // @ts-ignore
                const lat   = Swe.HEAPF64[buffer / 8 + 1];
                // @ts-ignore
                const dist  = Swe.HEAPF64[buffer / 8 + 2];
                // @ts-ignore
                const speed = Swe.HEAPF64[buffer / 8 + 3];

                // Equatorial coords for declination
                const eqFlags = this.module.SEFLG_EQUATORIAL | this.module.SEFLG_MOSEPH;
                Swe.ccall(
                    'swe_calc_ut', 'number',
                    ['number', 'number', 'number', 'pointer', 'pointer'],
                    [jd, pid, eqFlags, buffer, null],
                );
                // @ts-ignore
                const dec = Swe.HEAPF64[buffer / 8 + 1];

                let finalLon = lon;
                let finalLat = lat;

                if (topocentric && location && dist > 0) {
                    const topo = calculateParallax(lon, lat, dist, location.latitude, lst, obl);
                    finalLon   = topo.lon;
                    finalLat   = topo.lat;
                }

                planets.push({
                    id:          pid,
                    name:        this.getPlanetName(pid),
                    longitude:   finalLon,
                    latitude:    finalLat,
                    distance:    dist,
                    speed,
                    declination: dec,
                });
            }
        } finally {
            // @ts-ignore
            Swe._free(buffer);
        }

        // Ketu = Rahu + 180° (mean node South)
        const rahu = planets.find(p => p.name === 'Rahu');
        if (rahu) {
            planets.push({
                id:          99,
                name:        'Ketu',
                longitude:   (rahu.longitude + 180) % 360,
                latitude:    -rahu.latitude,
                distance:    rahu.distance,
                speed:       rahu.speed,
                declination: -rahu.declination,
            });
        }

        return planets;
    }

    // -----------------------------------------------------------------------
    // Houses
    // -----------------------------------------------------------------------

    /**
     * Compute house cusps using Swiss Ephemeris.
     *
     * @param julday     Julian Day (UT)
     * @param lat        Geographic latitude
     * @param lon        Geographic longitude
     * @param method     House system code: 'W'=WholeSign, 'P'=Placidus, 'O'=Porphyry
     * @param sidereal   When true (default), subtracts the current ayanamsa to return
     *                   nirayana (sidereal) positions — matching PyJHora's ascendant().
     *                   Requires setAyanamsa() to have been called before this method.
     */
    public getHouses(julday: number, lat: number, lon: number, method: string = 'W', sidereal: boolean = true): HouseData {
        this.checkInit();

        // @ts-ignore
        const Swe = this.module.SweModule || this.module;
        if (!Swe?._malloc || !Swe?._free || !Swe?.ccall) {
            throw new Error('SwissEph WASM module is missing required memory methods');
        }

        const cuspsPtr = Swe._malloc(13 * 8); // 13 doubles
        const ascmcPtr = Swe._malloc(10 * 8); // 10 doubles

        try {
            Swe.ccall(
                'swe_houses', null,
                ['number', 'number', 'number', 'number', 'pointer', 'pointer'],
                [julday, lat, lon, method.charCodeAt(0), cuspsPtr, ascmcPtr],
            );

            const cusps: number[] = [];
            for (let i = 1; i <= 12; i++) {
                // @ts-ignore
                cusps.push(Swe.HEAPF64[cuspsPtr / 8 + i]);
            }

            const ascmc: number[] = [];
            for (let i = 0; i < 10; i++) {
                // @ts-ignore
                ascmc.push(Swe.HEAPF64[ascmcPtr / 8 + i]);
            }

            if (sidereal) {
                // Subtract ayanamsa from ecliptic positions (Ascendant, MC, Vertex, cusps).
                // ARMC is sidereal time (hour angle), not an ecliptic position — do not subtract.
                const ayan = this.getAyanamsa(julday);
                const sub  = (deg: number) => ((deg - ayan) + 360) % 360;
                return {
                    cusps:     cusps.map(sub),
                    ascendant: sub(ascmc[0]),
                    mc:        sub(ascmc[1]),
                    armc:      ascmc[2],
                    vertex:    sub(ascmc[3]),
                };
            }

            return {
                cusps,
                ascendant: ascmc[0],
                mc:        ascmc[1],
                armc:      ascmc[2],
                vertex:    ascmc[3],
            };
        } finally {
            Swe._free(cuspsPtr);
            Swe._free(ascmcPtr);
        }
    }

    // -----------------------------------------------------------------------
    // Sidereal time & obliquity
    // -----------------------------------------------------------------------

    public getSiderealTime(julday: number): number {
        this.checkInit();
        return this.module.sidtime(julday);
    }

    /**
     * Returns true obliquity of ecliptic (eps), nutation in longitude (dpsi),
     * and nutation in obliquity (deps) for a given Julian Day.
     */
    public getEclipticObliquity(julday: number): { eps: number; dpsi: number; deps: number } {
        this.checkInit();
        // Body -1 = SE_ECL_NUT
        const res = this.module.calc_ut(julday, -1, 0);
        return { eps: res[0], dpsi: res[1], deps: res[2] };
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    private getPlanetName(id: number): string {
        const names: Record<number, string> = {
            0: 'Sun', 1: 'Moon', 2: 'Mercury', 3: 'Venus', 4: 'Mars',
            5: 'Jupiter', 6: 'Saturn', 10: 'Rahu', 11: 'Rahu',
        };
        return names[id] ?? 'Unknown';
    }

    private checkInit(): void {
        if (!this.initialized) {
            throw new Error('EphemerisEngine not initialised. Call await engine.initialize() first.');
        }
    }
}
