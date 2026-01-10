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

        this.initialized = true;
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
    public getPlanets(date: DateTime, _location?: GeoLocation, ayanamsaOrder?: number, topocentric: boolean = false): PlanetPosition[] {
        this.checkInit();
        const Swe = this.module.SweModule;

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
        const planetIds = [0, 1, 2, 3, 4, 5, 6, 11];

        // Pre-allocate buffer for results (6 doubles = 48 bytes)
        const buffer = Swe._malloc(6 * 8);

        try {
            for (let i = 0; i < planetIds.length; i++) {
                const pid = planetIds[i];
                let flags = this.module.SEFLG_MOSEPH | this.module.SEFLG_SIDEREAL | this.module.SEFLG_SPEED;

                // Call swe_calc_ut directly
                Swe.ccall('swe_calc_ut', 'number', ['number', 'number', 'number', 'pointer', 'pointer'], [jd, pid, flags, buffer, null]);
                
                // Copy values immediately from HEAPF64
                const lon = Swe.HEAPF64[buffer / 8 + 0];
                const lat = Swe.HEAPF64[buffer / 8 + 1];
                const dist = Swe.HEAPF64[buffer / 8 + 2];
                const speed = Swe.HEAPF64[buffer / 8 + 3];

                // Get Equatorial Coordinates for Declination
                const eqFlags = this.module.SEFLG_EQUATORIAL | this.module.SEFLG_MOSEPH;
                Swe.ccall('swe_calc_ut', 'number', ['number', 'number', 'number', 'pointer', 'pointer'], [jd, pid, eqFlags, buffer, null]);
                const dec = Swe.HEAPF64[buffer / 8 + 1];

                let finalLon = lon;
                let finalLat = lat;

                // Apply Manual Topocentric Correction
                if (topocentric && _location && dist > 0) {
                    const topo = calculateParallax(lon, lat, dist, _location.latitude, lst, obl);
                    finalLon = topo.lon;
                    finalLat = topo.lat;
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
            5: 'Jupiter', 6: 'Saturn', 11: 'Rahu'
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
        
        const Swe = this.module.SweModule;
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
                cusps.push(Swe.HEAPF64[cuspsPtr / 8 + i]);
            }

            const ascmc: number[] = [];
            for (let i = 0; i < 10; i++) {
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
