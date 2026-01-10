import { DateTime } from 'luxon';
import { EphemerisEngine, PlanetPosition, HouseData } from './engine/ephemeris.js';
import { Geocoder, CityData } from './engine/geocoder.js';
import { calculateHouseCusps, HouseSystemMethod } from './vedic/houses.js';
import { calculateVarga, calculateShashtyamsa, VargaPoint } from './vedic/vargas.js';
import { calculatePanchanga, PanchangaResult } from './vedic/panchanga.js';
import { calculateTimeUpagrahas, calculateDhumadiUpagrahas, UpagrahaPositions } from './vedic/upagrahas.js';
import { calculatePranapada, calculateInduLagna, calculateShreeLagna, calculateHoraLagna, calculateGhatiLagna, calculateBhavaLagna, calculateVarnadaLagna } from './vedic/special_lagnas.js';
import { PlanetaryStream, StreamConfig } from './stream/planetary_stream.js';
import { getRelationship, Relationship, PLANET_IDS } from './core/relationships.js';
import { KPSubLord, KPSignificator } from './kp/sublord.js';
import { KPRuling, RulingPlanetsResult } from './kp/ruling.js';
import { EphemerisInterpolator } from './engine/interpolator.js';
import { VargaDeities } from './vedic/deities.js';

// Re-export Interfaces
export type {
    PlanetPosition, HouseData,
    CityData,
    PanchangaResult,
    StreamConfig,
    KPSignificator, RulingPlanetsResult,
    VargaPoint,
    UpagrahaPositions,
    HouseSystemMethod
};

// Re-export Utils
export { normalize360, getShortestDistance, dmsToDecimal, decimalToDms } from './core/math.js';
export { calculateVarga, calculateShashtyamsa, VargaDeities, getRelationship, PLANET_IDS, Relationship };

export interface NodeJHoraConfig {
    ayanamsaOrder?: number; // 1 = Lahiri
    topocentric?: boolean;
}

const defaultEphemeris = new EphemerisEngine();

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
        return this.ephemeris.getPlanets(date, this.location, this.config.ayanamsaOrder, this.config.topocentric);
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

    getChart(date: DateTime, system: HouseSystemMethod = 'WholeSign'): { planets: PlanetPosition[], houses: HouseData } {
        const planets = this.getPlanets(date);
        const houses = this.getHouses(date, system);
        return { planets, houses };
    }

    getPanchanga(date: DateTime): PanchangaResult {
        const planets = this.getPlanets(date);
        const sun = planets.find(p => p.id === 0);
        const moon = planets.find(p => p.id === 1);
        if (!sun || !moon) throw new Error("Sun or Moon data missing");
        return calculatePanchanga(sun.longitude, moon.longitude, date);
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
    PlanetaryStream,
    KPSubLord, KPRuling,
    EphemerisInterpolator,
    calculateTimeUpagrahas, calculateDhumadiUpagrahas,
    calculatePranapada, calculateInduLagna, calculateShreeLagna,
    calculateHoraLagna, calculateGhatiLagna, calculateBhavaLagna, calculateVarnadaLagna
};
