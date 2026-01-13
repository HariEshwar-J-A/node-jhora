import { DateTime } from 'luxon';
import { normalize360 } from '../core/math.js';
import { calculateParallax } from '../core/astronomy.js';
// @ts-ignore - swisseph-wasm might not have types
import swisseph from 'swisseph-wasm';

export interface GeoLocation {
    latitude: number;
    longitude: number;
    altitude?: number; // meters
}

export interface PlanetPosition {
    id: number;
    name: string;
    longitude: number; // 0-360
    latitude: number;
    distance: number; // AU
    speed: number; // degrees per day
    declination: number; // Equatorial Latitude
}

export interface HouseData {
    cusps: number[]; // 1-12
    ascendant: number;
    mc: number;
    armc: number;
    vertex: number;
}

export class EphemerisEngine {
    private static instance: EphemerisEngine;
    private initialized: boolean = false;
    private module: any;

    public constructor() { }

    /**
     * Singleton instance (Optional usage).
     */
    public static getInstance(): EphemerisEngine {
        if (!EphemerisEngine.instance) {
            EphemerisEngine.instance = new EphemerisEngine();
        }
        return EphemerisEngine.instance;
    }

    /**
     * Initializes the WASM module.
     * This must be called before any calculations.
     */
    public async initialize(): Promise<void> {
        if (this.initialized) return;

        // Instantiate the class
        // @ts-ignore
        this.module = new swisseph();

        if (this.module.initSwissEph) {
            await this.module.initSwissEph();
        }

        // Try to fetch ephemeris files if configured (passed via globals or similar, or just try fetching from expected locations)
        // In browser context, we can try fetching from /ephe/
        if (typeof window !== 'undefined' && typeof fetch === 'function') {
            await this.loadEphemerisFiles('/ephe/');
        }

        this.initialized = true;
    }

    private async loadEphemerisFiles(baseUrl: string): Promise<void> {
        const files = ['sepl_18.se1', 'semo_18.se1', 'seas_18.se1'];
        
        // Robust FS detection
        // @ts-ignore
        const Swe = this.module.SweModule || this.module;
        // @ts-ignore
        const FS = Swe.FS || (this.module.FS);
        
        // Ensure FS is available
        if (!FS) {
            console.warn('SwissEph WASM FS not available, skipping file load');
            return;
        }

        try {
             // Create 'ephe' directory in MEMFS
             try {
                 FS.mkdir('/ephe');
             } catch(e) { /* ignore if exists */ }

             for (const file of files) {
                 try {
                     const response = await fetch(`${baseUrl}${file}`);
                     if (response.ok) {
                         const buffer = await response.arrayBuffer();
                         const data = new Uint8Array(buffer);
                         FS.createDataFile('/ephe', file, data, true, true, true); // canRead, canWrite, canOwn
                         console.log(`Loaded ${file} to WASM FS`);
                     } else {
                         console.warn(`Failed to fetch ${file}: ${response.statusText}`);
                     }
                 } catch (e) {
                     console.warn(`Error loading ${file}`, e);
                 }
             }
             
             // Set path using ccall with 'string' type (handles stringToUTF8 internally)
             try {
                if (Swe.ccall) {
                    Swe.ccall('swe_set_ephe_path', null, ['string'], ['/ephe']);
                    console.log('Set Swiss Ephemeris path to /ephe via ccall(string)');
                } else {
                    console.warn("Swe.ccall not available for setting ephe path");
                }
             } catch (e) {
                 console.error('Failed to set ephe path via ccall', e);
             }

        } catch (e) {
            console.error('Failed to load ephemeris files', e);
        }
    }

    /**
     * Sets the Ayanamsa mode.
     * @param mode - The Ayanamsa mode (e.g., swisseph.SE_SIDM_LAHIRI). 
     *               Default LAHIRI (Vedic Standard).
     */
    public setAyanamsa(mode: number): void {
        this.checkInit();
        this.module.set_sid_mode(mode, 0, 0);
    }

    /**
     * Calculates planetary positions for a given date.
     * @param date - Luxon DateTime
     * @param _location - Observer location (used for Topocentric Moon)
     * @param ayanamsaOrder - Optional override for Ayanamsa
     * @param topocentric - Enable Parallax correction (default: false)
     */
    public getPlanets(date: DateTime, _location?: GeoLocation, options: { ayanamsaOrder?: number, topocentric?: boolean, nodeType?: 'mean' | 'true', ayanamsaOffset?: number } = {}): PlanetPosition[] {
        // console.log('EphemerisEngine.getPlanets options:', JSON.stringify(options));
        this.checkInit();
        const Swe = this.module.SweModule || this.module;

        const { ayanamsaOrder, topocentric = false, nodeType = 'mean', ayanamsaOffset = 0 } = options;

        // Apply dynamic ayanamsa if requested
        if (ayanamsaOrder !== undefined) {
            this.setAyanamsa(ayanamsaOrder);
        }

        const utc = date.toUTC();
        const jd = this.module.julday(utc.year, utc.month, utc.day, utc.hour + utc.minute / 60 + utc.second / 3600, this.module.SE_GREG_CAL);

        // Get Obliquity (True) for Parallax
        let obl = 23.44;
        if (topocentric) {
            const oblData = this.getEclipticObliquity(jd);
            obl = oblData.eps + oblData.deps;
        }

        // Get LST for Parallax
        let lst = 0;
        if (topocentric && _location) {
            const gmst = this.getSiderealTime(jd);
            const lonHours = _location.longitude / 15;
            lst = normalize360((gmst + lonHours) * 15);
        }

        const planets: PlanetPosition[] = [];
        const planetIds = [0, 1, 2, 3, 4, 5, 6];
        planetIds.push(nodeType === 'true' ? 10 : 11); // 10 = True Node, 11 = Mean Node

        // Pre-allocate buffer for results (6 doubles = 48 bytes)
        // @ts-ignore
        const buffer = Swe._malloc(6 * 8);

        try {
            for (let i = 0; i < planetIds.length; i++) {
                const pid = planetIds[i];
                let flags = this.module.SEFLG_SIDEREAL | this.module.SEFLG_SPEED;

                // Call swe_calc_ut directly
                Swe.ccall('swe_calc_ut', 'number', ['number', 'number', 'number', 'pointer', 'pointer'], [jd, pid, flags, buffer, null]);

                // Copy values immediately from HEAPF64
                // @ts-ignore
                const lon = Swe.HEAPF64[buffer / 8 + 0];
                // @ts-ignore
                const lat = Swe.HEAPF64[buffer / 8 + 1];
                // @ts-ignore
                const dist = Swe.HEAPF64[buffer / 8 + 2];
                // @ts-ignore
                const speed = Swe.HEAPF64[buffer / 8 + 3];

                // Get Equatorial Coordinates for Declination
                const eqFlags = this.module.SEFLG_EQUATORIAL | this.module.SEFLG_MOSEPH;
                Swe.ccall('swe_calc_ut', 'number', ['number', 'number', 'number', 'pointer', 'pointer'], [jd, pid, eqFlags, buffer, null]);
                // @ts-ignore
                const dec = Swe.HEAPF64[buffer / 8 + 1];

                let finalLon = lon;
                let finalLat = lat;

                if (topocentric && _location && dist > 0) {
                    const topo = calculateParallax(lon, lat, dist, _location.latitude, lst, obl);
                    finalLon = topo.lon;
                    finalLat = topo.lat;
                }

                // Apply Ayanamsa Offset (Manual Correction)
                // If ayanamsaOffset is positive, it means Ayanamsa is larger, so Sidereal Longitude is smaller.
                if (ayanamsaOffset !== 0) {
                   finalLon = normalize360(finalLon - ayanamsaOffset);
                }

                planets.push({
                    id: pid,
                    name: this.getPlanetName(pid),
                    longitude: finalLon,
                    latitude: finalLat,
                    distance: dist,
                    speed: speed,
                    declination: dec
                });
            }
        } finally {
            // @ts-ignore
            Swe._free(buffer);
        }

        // Add Ketu (Opposite of Rahu)
        const rahu = planets.find(p => p.name === 'Rahu');
        if (rahu) {
            let ketuLon = (rahu.longitude + 180) % 360;
            planets.push({
                id: 99,
                name: 'Ketu',
                longitude: ketuLon,
                latitude: -rahu.latitude,
                distance: rahu.distance,
                speed: rahu.speed,
                declination: -rahu.declination
            });
        }

        return planets;
    }

    /**
     * Helper to map ID to Name
     */
    private getPlanetName(id: number): string {
        const names: { [key: number]: string } = {
            0: 'Sun', 1: 'Moon', 2: 'Mercury', 3: 'Venus', 4: 'Mars',
            5: 'Jupiter', 6: 'Saturn', 11: 'Rahu', 10: 'Rahu'
        };
        return names[id] || 'Unknown';
    }

    /**
     * Calculates House Cusps and Ascendant/MC.
     * 
     * @param julday - Julian Day (UT)
     * @param lat - Latitude
     * @param lon - Longitude
     * @param method - House system code (e.g., 'P' for Placidus, 'O' for Porphyry, 'W' for Whole Sign - though WS is handled usually via logic)
     * @returns HouseData
     */
    public getSiderealTime(julday: number): number {
        this.checkInit();
        return this.module.sidtime(julday);
    }

    /**
     * Returns true obliquity of ecliptic (epsilon) + nutation in longitude (dpsi) + nutation in obliquity (deps).
     * @param julday 
     */
    public getEclipticObliquity(julday: number): { eps: number, dpsi: number, deps: number } {
        this.checkInit();
        // Body -1 is SE_ECL_NUT
        // Flags: SEFLG_SWIEPH (default)
        // Returns [eps, dpsi, deps, speed]
        // Note: dpsi and deps are usually small. eps is around 23.44.
        const res = this.module.calc_ut(julday, -1, 0);
        return {
            eps: res[0],
            dpsi: res[1],
            deps: res[2]
        };
    }

    /**
     * Calculates houses using Swiss Ephemeris (supporting Placidus, etc.)
     * @param julday - Julian Day
     * @param lat - Latitude
     * @param lon - Longitude
     * @param houseMethod - 'P' (Placidus), 'W' (WholeSign - though SE mapping might be 'W'), 'O' (Porphyry), etc. 
     *                      Standard Keys: 'P' = Placidus, 'K' = Koch, 'O' = Porphyry, 'E' = Equal, 'W' = Whole Sign.
     * @returns HouseData
     */
    public getHouses(julday: number, lat: number, lon: number, houseMethod: string = 'P'): HouseData {
        this.checkInit();
        
        // @ts-ignore
        const Swe = this.module.SweModule || this.module;
        if (!Swe || !Swe._malloc || !Swe._free || !Swe.ccall) {
            throw new Error("SwissEph WASM module missing required memory/call methods");
        }

        const cuspsPtr = Swe._malloc(13 * 8); // 13 doubles
        const ascmcPtr = Swe._malloc(10 * 8); // 10 doubles

        try {
            // we use sweat_houses(jd, lat, lon, hsys, cusps, ascmc)
            const hsysCode = houseMethod.charCodeAt(0);
            
            Swe.ccall(
                'swe_houses', 
                null, 
                ['number', 'number', 'number', 'number', 'pointer', 'pointer'], 
                [julday, lat, lon, hsysCode, cuspsPtr, ascmcPtr]
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

            return {
                cusps,
                ascendant: ascmc[0],
                mc: ascmc[1],
                armc: ascmc[2],
                vertex: ascmc[3]
            };
        } finally {
            Swe._free(cuspsPtr);
            Swe._free(ascmcPtr);
        }
    }

    private checkInit() {
        if (!this.initialized) {
            throw new Error("EphemerisEngine not initialized. Call initialize() first.");
        }
    }
}
