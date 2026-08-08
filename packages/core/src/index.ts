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
import { AYANAMSA } from './engine/ephemeris.js';
import { DEFAULT_CONFIG, JHORA_PRESET, resolveConfig, TROPICAL_YEAR_DAYS, type JyotishConfig } from './config.js';

// Re-export Interfaces
export type {
    PlanetPosition, HouseData,
    PanchangaResult,
    KPSignificator, RulingPlanetsResult,
    VargaPoint,
    UpagrahaPositions,
    HouseSystemMethod
};

// Re-export Utils
export { normalize360, getShortestDistance, dmsToDecimal, decimalToDms } from './core/math.js';
export { D, toNum, normalize360D, NAKSHATRA_SPAN_D, DASHA_YEAR_DAYS } from './core/precise.js';
export { calculateVarga, calculateShashtyamsa, VargaDeities, getRelationship, PLANET_IDS, Relationship };
export { AYANAMSA, DEFAULT_AYANAMSA, DEFAULT_POSITION_MODE, DEFAULT_NODE_TYPE } from './engine/ephemeris.js';
export type { AyanamsaMode, PositionMode } from './engine/ephemeris.js';
export { DEFAULT_DASAMSA_SCHEME } from './vedic/vargas.js';
export type { DasamsaScheme, VargaOptions } from './vedic/vargas.js';
export { ayanamsaName, AYANAMSA_MODELS } from './engine/ayanamsa.js';
export {
    DEFAULT_CONFIG, JHORA_PRESET, resolveConfig, TROPICAL_YEAR_DAYS,
} from './config.js';
export type { JyotishConfig, HouseSystem, NodeType } from './config.js';
export { parseJhd, jhdToUtcISO, hasPositions, sexagesimalToDecimal, JHD_BODY_ORDER } from './io/jhd.js';
export type { JhdChart, JhdBody } from './io/jhd.js';

// Chart Data type for convenience
export interface ChartData {
    planets: PlanetPosition[];
    houses: HouseData;
    ascendant: number;
    ayanamsa: string;
}

/**
 * Ayanamsa names accepted by the convenience API.
 * For the full set of models use `config.ayanamsaMode` with an `AYANAMSA.*` code.
 */
export type Ayanamsa =
    | 'TrueChitra' | 'TruePushya' | 'TrueRevati' | 'TrueMula'
    | 'Lahiri' | 'LahiriICRC' | 'Raman' | 'KP' | 'Yukteshwar' | 'FaganBradley';

const AYANAMSA_BY_NAME: Record<Ayanamsa, number> = {
    TrueChitra:   AYANAMSA.TRUE_CITRA,
    TruePushya:   AYANAMSA.TRUE_PUSHYA,
    TrueRevati:   AYANAMSA.TRUE_REVATI,
    TrueMula:     AYANAMSA.TRUE_MULA,
    Lahiri:       AYANAMSA.LAHIRI,
    LahiriICRC:   AYANAMSA.LAHIRI_ICRC,
    Raman:        AYANAMSA.RAMAN,
    KP:           AYANAMSA.KRISHNAMURTI,
    Yukteshwar:   AYANAMSA.YUKTESHWAR,
    FaganBradley: AYANAMSA.FAGAN_BRADLEY,
};

/**
 * Instance configuration. Every field is optional and falls back to
 * {@link DEFAULT_CONFIG}; every field can also be overridden per call.
 *
 * `ayanamsaOrder` is retained as an alias for `ayanamsaMode` so existing code
 * keeps working.
 */
export interface NodeJHoraConfig extends Partial<JyotishConfig> {
    /** @deprecated Use `ayanamsaMode`. Retained for backward compatibility. */
    ayanamsaOrder?: number;
}

/** Normalise the deprecated alias into a full config. */
function toConfig(c: NodeJHoraConfig = {}): JyotishConfig {
    const { ayanamsaOrder, ...rest } = c;
    return resolveConfig({
        ...rest,
        ayanamsaMode: rest.ayanamsaMode ?? ayanamsaOrder,
    });
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
    private location: { latitude: number, longitude: number, altitude?: number };
    /** Instance defaults. Every method accepts a per-call override. */
    public readonly config: JyotishConfig;

    constructor(
        location: { latitude: number, longitude: number, altitude?: number },
        config: NodeJHoraConfig = {},
    ) {
        this.location  = location;
        this.ephemeris = EphemerisEngine.getInstance();
        this.config    = toConfig(config);
    }

    /** Resolve a per-call override against this instance's defaults. */
    private cfg(override?: NodeJHoraConfig): JyotishConfig {
        if (!override) return this.config;
        const { ayanamsaOrder, ...rest } = override;
        return resolveConfig(
            { ...rest, ayanamsaMode: rest.ayanamsaMode ?? ayanamsaOrder },
            this.config,
        );
    }

    async init() {
        await this.ephemeris.initialize();
    }

    // ========== STATIC API ==========
    
    /**
     * Initialize the WASM engine (call once before calculate)
     */
    public static async init(): Promise<void> {
        await EphemerisEngine.getInstance().initialize();
    }

    /**
     * Quick calculation without creating an instance
     * Note: Call NodeJHora.init() first or this will call it automatically
     */
    public static async calculate(
        date: Date,
        location: { latitude: number, longitude: number, altitude?: number },
        ayanamsaName: Ayanamsa = 'TrueChitra',
        config: NodeJHoraConfig = {},
    ): Promise<ChartData & { panchanga: PanchangaResult }> {
        // An explicit ayanamsaMode in the config wins over the name argument.
        const c = toConfig({
            ayanamsaMode: config.ayanamsaMode ?? config.ayanamsaOrder ?? AYANAMSA_BY_NAME[ayanamsaName],
            ...config,
        });

        const engine = EphemerisEngine.getInstance();
        await engine.initialize();

        const dt = DateTime.fromJSDate(date);
        const planets = engine.getPlanets(
            dt,
            { ...location, altitude: location.altitude ?? c.altitudeMetres },
            {
                ayanamsaOrder:  c.ayanamsaMode,
                ayanamsaOffset: c.ayanamsaOffset,
                topocentric:    c.topocentric,
                nodeType:       c.nodeType,
                positionMode:   c.positionMode,
            },
        );
        const housesResult = calculateHouseCusps(
            dt, location.latitude, location.longitude,
            c.houseSystem as HouseSystemMethod, engine, c.ayanamsaMode, c.ayanamsaOffset,
        );

        const sun  = planets.find(p => p.id === 0);
        const moon = planets.find(p => p.id === 1);
        let panchanga: any = null;
        if (sun && moon) {
            panchanga = calculatePanchanga(sun.longitude, moon.longitude, dt, c.sunriseHour);
        }

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
            panchanga,
            ascendant: houses.ascendant,
            ayanamsa: ayanamsaName
        };
    }

    // ========== INSTANCE METHODS ==========

    public getPlanets(date: DateTime, override?: NodeJHoraConfig): PlanetPosition[] {
        const c = this.cfg(override);
        return this.ephemeris.getPlanets(
            date,
            { ...this.location, altitude: this.location.altitude ?? c.altitudeMetres },
            {
                ayanamsaOrder:  c.ayanamsaMode,
                ayanamsaOffset: c.ayanamsaOffset,
                topocentric:    c.topocentric,
                nodeType:       c.nodeType,
                positionMode:   c.positionMode,
            },
        );
    }

    getHouses(date: DateTime, override?: NodeJHoraConfig): HouseData {
        const c = this.cfg(override);
        const res = calculateHouseCusps(
            date, this.location.latitude, this.location.longitude,
            c.houseSystem as HouseSystemMethod, this.ephemeris,
            c.ayanamsaMode, c.ayanamsaOffset,
        );
        return {
            cusps: res.cusps,
            ascendant: res.ascendant,
            mc: res.mc,
            armc: res.armc,
            vertex: res.vertex || 0,
        };
    }

    getChart(date: DateTime, override?: NodeJHoraConfig): { planets: PlanetPosition[], houses: HouseData } {
        const c = this.cfg(override);
        return { planets: this.getPlanets(date, c), houses: this.getHouses(date, c) };
    }

    getPanchanga(date: DateTime, override?: NodeJHoraConfig): PanchangaResult {
        const c = this.cfg(override);
        const planets = this.getPlanets(date, c);
        const sun  = planets.find(p => p.id === 0);
        const moon = planets.find(p => p.id === 1);
        if (!sun || !moon) throw new Error('Sun or Moon data missing');
        return calculatePanchanga(sun.longitude, moon.longitude, date, c.sunriseHour);
    }

    /** Divisional chart for one longitude, honouring the configured varga rules. */
    getVarga(longitude: number, division: number, override?: NodeJHoraConfig): VargaPoint {
        const c = this.cfg(override);
        return calculateVarga(longitude, division, { dasamsaScheme: c.dasamsaScheme });
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
