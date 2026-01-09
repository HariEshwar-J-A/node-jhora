import { DateTime } from 'luxon';
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
     * Calculates planetary positions for a given date and location.
     * @param date - Luxon DateTime
     * @param _location - GeoLocation
     * @returns PlanetPosition[]
     */
    public getPlanets(date: DateTime, _location?: GeoLocation, ayanamsaOrder?: number): PlanetPosition[] {
        this.checkInit();

        if (ayanamsaOrder !== undefined) {
            this.setAyanamsa(ayanamsaOrder);
        }

        const dateUtc = date.toUTC();

        const year = dateUtc.year;
        const month = dateUtc.month;
        const day = dateUtc.day;
        const hour = dateUtc.hour + dateUtc.minute / 60 + dateUtc.second / 3600;

        const julday_ut = this.module.julday(year, month, day, hour, this.module.SE_GREG_CAL);

        const flags = this.module.SEFLG_SIDEREAL | this.module.SEFLG_SPEED | this.module.SEFLG_MOSEPH;

        const planets: PlanetPosition[] = [];

        const bodies = [
            { id: 0, name: 'Sun' },
            { id: 1, name: 'Moon' },
            { id: 4, name: 'Mars' },
            { id: 2, name: 'Mercury' },
            { id: 5, name: 'Jupiter' },
            { id: 3, name: 'Venus' },
            { id: 6, name: 'Saturn' },
            { id: 11, name: 'Rahu' },
        ];

        for (const body of bodies) {
            const result = this.module.calc_ut(julday_ut, body.id, flags);

            // Result is Float64Array: [longitude, latitude, distance, speedLong, speedLat, speedDist]

            // Get Equatorial Coordinates for Declination (Required for Shadbala/Ayanabala)
            // Use SEFLG_EQUATORIAL (2048).
            const eqFlags = this.module.SEFLG_EQUATORIAL | this.module.SEFLG_MOSEPH;
            const eqResult = this.module.calc_ut(julday_ut, body.id, eqFlags);
            // eqResult[0] = Right Ascension, eqResult[1] = Declination

            planets.push({
                id: body.id,
                name: body.name,
                longitude: result[0],
                latitude: result[1],
                distance: result[2],
                speed: result[3],
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
