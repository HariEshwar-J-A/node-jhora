/**
 * Browser-safe entry point for @node-jhora/core
 * Excludes Node.js-only modules (Geocoder, PlanetaryStream)
 */
import { DateTime } from 'luxon';
import { EphemerisEngine, PlanetPosition, HouseData } from './engine/ephemeris.js';
import { calculateHouseCusps, HouseSystemMethod } from './vedic/houses.js';
import { calculateVarga, calculateShashtyamsa, VargaPoint } from './vedic/vargas.js';
import { calculatePanchanga, PanchangaResult } from './vedic/panchanga.js';
import { calculateTimeUpagrahas, calculateDhumadiUpagrahas, UpagrahaPositions } from './vedic/upagrahas.js';
import { calculatePranapada, calculateInduLagna, calculateShreeLagna, calculateHoraLagna, calculateGhatiLagna, calculateBhavaLagna, calculateVarnadaLagna } from './vedic/special_lagnas.js';
import { getRelationship, Relationship, PLANET_IDS } from './core/relationships.js';
import { KPSubLord, KPSignificator } from './kp/sublord.js';
import { KPRuling, RulingPlanetsResult } from './kp/ruling.js';
import { VargaDeities } from './vedic/deities.js';

// Re-export Interfaces
export type {
    PlanetPosition, HouseData,
    PanchangaResult,
    KPSignificator, RulingPlanetsResult,
    VargaPoint,
    UpagrahaPositions,
    HouseSystemMethod
};

// Chart Data type for convenience
export interface ChartData {
    planets: PlanetPosition[];
    houses: HouseData;
    ascendant: number;
    ayanamsa: string;
}

export type Ayanamsa = 'Lahiri' | 'Raman' | 'KP';

// Re-export Utils
export { normalize360, getShortestDistance, dmsToDecimal, decimalToDms } from './core/math.js';
export { calculateVarga, calculateShashtyamsa, VargaDeities, getRelationship, PLANET_IDS, Relationship };

export interface NodeJHoraConfig {
    ayanamsaOrder?: number; // 1 = Lahiri
    topocentric?: boolean;
    nodeType?: 'mean' | 'true';
    ayanamsaOffset?: number;
}

// Singleton engine for static API
let _engineInstance: EphemerisEngine | null = null;
let _initialized = false;

async function getEngine(): Promise<EphemerisEngine> {
    if (!_engineInstance) {
        _engineInstance = new EphemerisEngine();
    }
    if (!_initialized) {
        await _engineInstance.initialize();
        _initialized = true;
    }
    return _engineInstance;
}

/**
 * Facade Class for Object-Oriented Usage
 */
export class NodeJHora {
    private ephemeris: EphemerisEngine;
    private location: { latitude: number, longitude: number };
    private ayanamsa: number;
    private ayanamsaName: Ayanamsa;
    private config: NodeJHoraConfig;

    constructor(
        location: { latitude: number, longitude: number },
        config: NodeJHoraConfig = { ayanamsaOrder: 1 }
    ) {
        this.location = location;
        this.ephemeris = EphemerisEngine.getInstance();
        this.ayanamsa = config.ayanamsaOrder || 1;
        this.ayanamsaName = this.ayanamsa === 1 ? 'Lahiri' : this.ayanamsa === 3 ? 'Raman' : 'KP';
        this.config = config;
    }

    async init() {
        await this.ephemeris.initialize();
    }

    // ========== STATIC API ==========
    
    /**
     * Initialize the WASM engine (call once before calculate)
     */
    public static async init(): Promise<void> {
        await getEngine();
    }

    /**
     * Quick calculation without creating an instance
     */
    public static calculate(
        date: Date, 
        location: { latitude: number, longitude: number }, 
        ayanamsaName: Ayanamsa = 'Lahiri',
        config: NodeJHoraConfig = { topocentric: true }
    ): ChartData {
        const ayanamsaMap: Record<Ayanamsa, number> = {
            'Lahiri': 1,
            'Raman': 3,
            'KP': 5
        };
        const ayanamsaOrder = ayanamsaMap[ayanamsaName];
        const engine = EphemerisEngine.getInstance();
        
        const dt = DateTime.fromJSDate(date);
        const planets = engine.getPlanets(dt, location, {
            ayanamsaOrder,
            topocentric: config.topocentric,
            nodeType: config.nodeType,
        });
        const housesResult = calculateHouseCusps(dt, location.latitude, location.longitude, 'WholeSign', engine);
        
        const houses: HouseData = {
            cusps: housesResult.cusps,
            ascendant: housesResult.ascendant,
            mc: housesResult.mc,
            armc: housesResult.armc,
            vertex: housesResult.vertex || 0
        };

        return {
            planets,
            houses,
            ascendant: houses.ascendant,
            ayanamsa: ayanamsaName
        };
    }

    // ========== INSTANCE METHODS ==========

    public getPlanets(date: DateTime): PlanetPosition[] {
        return this.ephemeris.getPlanets(date, this.location, {
            ayanamsaOrder: this.config.ayanamsaOrder,
            topocentric: this.config.topocentric,
            nodeType: this.config.nodeType,
        });
    }

    getHouses(date: DateTime, system: HouseSystemMethod = 'WholeSign'): HouseData {
        const res = calculateHouseCusps(date, this.location.latitude, this.location.longitude, system, this.ephemeris);
        return {
            cusps: res.cusps,
            ascendant: res.ascendant,
            mc: res.mc,
            armc: res.armc,
            vertex: res.vertex || 0
        };
    }

    getChart(date: DateTime, system: HouseSystemMethod = 'WholeSign'): ChartData {
        const planets = this.getPlanets(date);
        const houses = this.getHouses(date, system);
        return { 
            planets, 
            houses,
            ascendant: houses.ascendant,
            ayanamsa: this.ayanamsaName
        };
    }

    getPanchanga(date: DateTime): PanchangaResult {
        const planets = this.getPlanets(date);
        const sun = planets.find(p => p.id === 0);
        const moon = planets.find(p => p.id === 1);
        if (!sun || !moon) throw new Error("Sun or Moon data missing");
        return calculatePanchanga(sun.longitude, moon.longitude, date);
    }
}

// Functional Exports (Browser-safe only)
export {
    EphemerisEngine,
    calculateHouseCusps,
    calculatePanchanga,
    KPSubLord, KPRuling,
    calculateTimeUpagrahas, calculateDhumadiUpagrahas,
    calculatePranapada, calculateInduLagna, calculateShreeLagna,
    calculateHoraLagna, calculateGhatiLagna, calculateBhavaLagna, calculateVarnadaLagna
};
