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
        if (!this.module) {
            throw new Error("EphemerisEngine not initialized. Call init() first.");
        }

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
            // Greenwich ST
            const gmst = this.getSiderealTime(jd);
            // Local ST = GMST + Lon/15
            const lonHours = _location.longitude / 15;
            lst = normalize360((gmst + lonHours) * 15);
        }

        const planets: PlanetPosition[] = [];

        // Define mapping: 0=Sun..8=Ketu.
        // SwissEph IDs: Sun=0, Moon=1, Merc=2, Ven=3, Mar=4, Jup=5, Sat=6, Rahu=11, Ketu=SouthNode(calc)
        const planetIds = [0, 1, 2, 3, 4, 5, 6, 11];

        for (let i = 0; i < planetIds.length; i++) {
            const pid = planetIds[i];
            // Flag: SEFLG_SWIEPH (2), SEFLG_SIDEREAL (64*1024), SEFLG_SPEED (256), SEFLG_EQUATORIAL (2*1024 for Declination?)
            // We need Ecliptic Longitude (Sidereal) AND Equatorial Declination (for Shadbala/Parallax).
            // swisseph-wasm `calc_ut` returns array [lon, lat, dist, speedInLon, speedInLat, speedInDist].
            // To get Declination, we need a separate call with SEFLG_EQUATORIAL?
            // Or use simple conversion. 
            // Better to make 2 calls if we need high precision Declination.
            // Let's stick to Sidereal Ecliptic first.
            // Flag: SEFLG_MOSEPH (4) - ESSENTIAL for no-file mode.
            // SEFLG_SWIEPH (2) tries to use files.
            let flags = this.module.SEFLG_MOSEPH | this.module.SEFLG_SIDEREAL | this.module.SEFLG_SPEED;

            // Just basic Sidereal.
            const res = this.module.calc_ut(jd, pid, flags);
            let lon = res[0];
            let lat = res[1];
            let dist = res[2];
            let speed = res[3];

            // Apply Manual Topocentric Correction
            if (topocentric && _location && dist > 0) {
                // For Moon (pid=1) it's critical. Others less so, but apply to all for "Perfect".
                // Correction returns Topocentric Longitude.
                const topo = calculateParallax(lon, lat, dist, _location.latitude, lst, obl);
                lon = topo.lon;
                lat = topo.lat;
                // Note: Speed should also be corrected but difference is minute for astrology.
            }

            // Get Equatorial Coordinates for Declination (Required for Shadbala/Ayanabala)
            // Use SEFLG_EQUATORIAL (2048).
            const eqFlags = this.module.SEFLG_EQUATORIAL | this.module.SEFLG_MOSEPH;
            const eqResult = this.module.calc_ut(jd, pid, eqFlags);
            // eqResult[0] = Right Ascension, eqResult[1] = Declination

            planets.push({
                id: pid, // Use pid directly
                name: this.getPlanetName(pid), // Use helper to get name
                longitude: lon, // Use corrected lon
                latitude: lat, // Use corrected lat
                distance: dist,
                speed: speed,
                declination: eqResult[1]
            });
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
                declination: -rahu.declination // Approximation: Ketu is opposite node, declination is opposite? 
                // Nodes intersect ecliptic. Lat is 0? 
                // Rahu/Ketu latitude is not 0 (mean nodes). 
                // For declination, opposite point on celestial sphere -> dec is -dec.
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

    private checkInit() {
        if (!this.initialized) {
            throw new Error("EphemerisEngine not initialized. Call initialize() first.");
        }
    }
}
