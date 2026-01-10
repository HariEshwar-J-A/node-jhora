import { DateTime } from 'luxon';
import { EphemerisEngine, PlanetPosition, HouseData } from './engine/ephemeris.js';
import { Geocoder, CityData } from './engine/geocoder.js';
import { calculateHouseCusps } from './vedic/houses.js';
import { calculateVarga, calculateShashtyamsa, VargaPoint } from './vedic/vargas.js';
import { calculatePanchanga, PanchangaResult } from './vedic/panchanga.js';
import { calculateShadbala, ShadbalaResult } from './analytics/shadbala.js';
import { generateVimshottari, DashaPeriod } from './predictive/dasha.js';
import { PlanetaryStream, StreamConfig } from './stream/planetary_stream.js';
import { getRelationship, Relationship } from './core/relationships.js';
import { JaiminiCore, JaiminiKaraka, ArudhaPada } from './jaimini/core.js';
import { JaiminiDashas, CharaDashaPeriod } from './jaimini/dashas.js';
import { KPSubLord, KPSignificator } from './kp/sublord.js';
import { KPRuling, RulingPlanetsResult } from './kp/ruling.js';
import { YogaEngine, ChartData } from './yogas/engine.js';
import { Ashtakavarga, AshtakavargaResult } from './analytics/ashtakavarga.js';
import { TransitEngine, TransitEvent } from './predictive/transits.js';
import { YOGA_LIBRARY } from './yogas/library.js';
import { VargaDeities } from './vedic/deities.js';

// Re-export Interfaces
export type {
    PlanetPosition, HouseData,
    CityData,
    PanchangaResult,
    ShadbalaResult,
    DashaPeriod,
    StreamConfig,
    Relationship,
    ChartData,
    JaiminiKaraka, ArudhaPada, CharaDashaPeriod,
    KPSignificator, RulingPlanetsResult,
    AshtakavargaResult, TransitEvent
};

// Re-export Utils
export { normalize360, getShortestDistance, dmsToDecimal, decimalToDms } from './core/math.js';
export { calculateVarga, calculateShashtyamsa };

export interface NodeJHoraConfig {
    ayanamsaOrder?: number; // 1 = Lahiri
    topocentric?: boolean;
}

// Global Singleton Instance of Engine?
// Usually better to let user instantiate, but we can provide a default instance or factory.
const defaultEphemeris = new EphemerisEngine();

// Init function to ensure WASM is loaded if not using Class
export async function init(): Promise<void> {
    await defaultEphemeris.initialize();
}

/**
 * Facade Class for Object-Oriented Usage
 */
export class NodeJHora {
    private ephemeris: EphemerisEngine;
    private location: { latitude: number, longitude: number };
    private ayanamsa: number;
    private config: NodeJHoraConfig;

    constructor(
        location: { latitude: number, longitude: number },
        config: NodeJHoraConfig = { ayanamsaOrder: 1 }
    ) {
        this.location = location;
        this.ephemeris = EphemerisEngine.getInstance();
        this.ayanamsa = config.ayanamsaOrder || 1;
        this.config = config;
    }

    async init() {
        await this.ephemeris.initialize();
    }

    public getPlanets(date: DateTime): PlanetPosition[] {
        const planets = this.ephemeris.getPlanets(date, this.location, this.config.ayanamsaOrder, this.config.topocentric);
        return planets;
    }

    getHouses(date: DateTime): HouseData {
        // Note: calculateHouseCusps currently returns Tropical/Sayana cusps implicitly 
        // as it uses RAW RAMC/Obliquity without Ayanamsa subtraction.
        // For a full Vedic engine, we ideally subtract Ayanamsa here or in the house function.
        // For MVP Phase 7, we integrate as-is.
        const res = calculateHouseCusps(date, this.location.latitude, this.location.longitude, 'WholeSign', this.ephemeris);
        return {
            cusps: res.cusps,
            ascendant: res.ascendant,
            mc: res.mc,
            armc: res.armc,
            vertex: res.vertex || 0
        };
    }

    getChart(date: DateTime): { planets: PlanetPosition[], houses: HouseData } {
        const planets = this.getPlanets(date);
        const houses = this.getHouses(date);
        return { planets, houses };
    }

    calculateVarga(planetLong: number, vargaNum: number): VargaPoint {
        return calculateVarga(planetLong, vargaNum);
    }

    getPanchanga(date: DateTime): PanchangaResult {
        const planets = this.getPlanets(date);
        const sun = planets.find(p => p.id === 0);
        const moon = planets.find(p => p.id === 1);
        if (!sun || !moon) throw new Error("Sun or Moon data missing");

        // Use default sunriseHour of 6.0 as we are not calculating it yet.
        return calculatePanchanga(sun.longitude, moon.longitude, date);
    }

    getShadbala(date: DateTime, birthHour: number, sunrise: number, sunset: number): ShadbalaResult {
        const { planets, houses } = this.getChart(date);
        const sun = planets.find(p => p.id === 0);
        const moon = planets.find(p => p.id === 1);
        if (!sun || !moon) throw new Error("Sun/Moon missing");

        // Varga Positions Calculation (D1, D9...)
        // Simplified for facade: calculating D1 and D9 for all planets
        const vargaPositions = planets.flatMap(p => [
            { vargaName: 'D1', sign: Math.floor(p.longitude / 30) + 1, lordId: -1, lordRashiSign: -1 }, // Lord ID logic needed
            { vargaName: 'D9', sign: calculateVarga(p.longitude, 9).sign, lordId: -1, lordRashiSign: -1 }
        ]);

        // NOTE: Full Shadbala requires finding Lords and their positions.
        // This facade method is a convenience stub. Real usage might need more data prep.
        // For MVP, we adhere to the core function which assumes inputs are ready.
        // We will expose the core function `calculateShadbala` for power users.
        throw new Error("Use calculateShadbala core function for full control. Facade implementation requires comprehensive Varga lordship lookup which is data-intensive.");
    }

    getDasha(getDate: boolean = false, birthDate: DateTime): DashaPeriod[] {
        // Dasha mainly depends on Moon.
        // Note: This requires getting Moon position AT BIRTH.
        // User should pass Birth Moon Longitude or compute it from Birth Date.
        throw new Error("Use generateVimshottari(birthDate, moonLong) directly.");
    }

    createStream(intervalMs: number = 1000): PlanetaryStream {
        return new PlanetaryStream(this.ephemeris, {
            location: this.location,
            intervalMs,
            ayanamsa: this.ayanamsa
        });
    }
}

// Functional Exports
export {
    EphemerisEngine,
    Geocoder,
    calculateHouseCusps,
    calculatePanchanga,
    calculateShadbala,
    generateVimshottari,
    PlanetaryStream,
    YogaEngine,
    YOGA_LIBRARY,
    JaiminiCore, JaiminiDashas,
    KPSubLord, KPRuling,
    Ashtakavarga,
    TransitEngine,
    VargaDeities
};
