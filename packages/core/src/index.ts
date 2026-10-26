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
import { type JyotishConfig } from './config.js';
import { describeCalculation, isSettingsShape, type CalculationSettings, type SettingsInput } from './settings/index.js';

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
export { DEFAULT_DASAMSA_SCHEME, DEFAULT_HORA_SCHEME } from './vedic/vargas.js';
export type { DasamsaScheme, HoraScheme, VargaOptions } from './vedic/vargas.js';
export { ayanamsaName, AYANAMSA_MODELS } from './engine/ayanamsa.js';
export {
    DEFAULT_CONFIG, JHORA_PRESET, resolveConfig, TROPICAL_YEAR_DAYS,
} from './config.js';
export type { JyotishConfig, HouseSystem, NodeType } from './config.js';
export {
    AYANAMSA_IDS, AYANAMSA_MODE_BY_ID, CalculationSettingsSchema, DASA_YEAR_KINDS,
    HOUSE_SYSTEM_IDS, LEGACY_DASHA_YEAR_DAYS, LEGACY_DASHA_YEAR_DAYS_TEXT,
    PRESET_IDS, PRESETS, SETTINGS_HASH_HEX_LENGTH, SUNRISE_LIMBS,
    canonicalJson, describeCalculation, expandCalculationBody, expandRequestBody,
    flatFromSettings, getPreset, hashSettings, inferDasaYearKind, isPresetId,
    isSettingsShape, resolveCalculationInput, settingsFromFlat, settingsToJyotishConfig,
} from './settings/index.js';
export type {
    AyanamsaId, CalculationSettings, DasaYearKind, HouseSystemId, PresetId,
    ResolvedCalculation, SettingsInput, SunriseLimb,
} from './settings/index.js';
export {
    DELTA_T_MODEL, EPHEMERIS_PROVIDER, createResultEnvelope, withResultEnvelope,
} from './envelope.js';
export type {
    ResultEnvelope, ResultEnvelopeOptions, SettingsHashValue, WithResultEnvelopeOptions,
} from './envelope.js';
export { ENGINE_VERSION, TZDB_VERSION } from './generated/build-constants.js';
export { parseJhd, jhdToUtcISO, hasPositions, sexagesimalToDecimal, JHD_BODY_ORDER } from './io/jhd.js';
export type { JhdChart, JhdBody } from './io/jhd.js';

// Chart Data type for convenience
export interface ChartData {
    planets: PlanetPosition[];
    houses: HouseData;
    ascendant: number;
    ayanamsa: string;
    /** Hash of the calculation settings that produced this chart. */
    settingsHash?: string;
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
    /** Validated settings bundle. Legacy config objects are mapped onto this. */
    public readonly settings: CalculationSettings;
    /** {@link hashSettings} of {@link settings}. */
    public readonly settingsHash: string;

    constructor(
        location: { latitude: number, longitude: number, altitude?: number },
        config: SettingsInput = {},
    ) {
        this.location = location;
        this.ephemeris = EphemerisEngine.getInstance();
        const resolved = describeCalculation(config);
        this.config = resolved.config;
        this.settings = resolved.settings;
        this.settingsHash = resolved.settingsHash;
    }

    /** Resolve a per-call override against this instance's defaults. */
    private bind(override?: SettingsInput) {
        if (override === undefined) {
            return { config: this.config, settings: this.settings, settingsHash: this.settingsHash };
        }
        return describeCalculation(override, this.settings);
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
        config: SettingsInput = {},
    ): Promise<ChartData & { panchanga: PanchangaResult; settingsHash: string }> {
        // A preset id or a settings object replaces the name. A legacy config
        // still lets an explicit mode win over the name, as before.
        const requested: SettingsInput = typeof config === 'string' || isSettingsShape(config)
            ? config
            : {
                ayanamsaMode: config.ayanamsaMode ?? config.ayanamsaOrder ?? AYANAMSA_BY_NAME[ayanamsaName],
                ...config,
            };
        const { config: c, settingsHash } = describeCalculation(requested);

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
            ayanamsa: ayanamsaName,
            settingsHash,
        };
    }

    // ========== INSTANCE METHODS ==========

    public getPlanets(date: DateTime, override?: SettingsInput): PlanetPosition[] {
        const { config: c } = this.bind(override);
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

    getHouses(date: DateTime, override?: SettingsInput): HouseData & { settingsHash: string } {
        const { config: c, settingsHash } = this.bind(override);
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
            settingsHash,
        };
    }

    getChart(date: DateTime, override?: SettingsInput): { planets: PlanetPosition[]; houses: HouseData; settingsHash: string } {
        const { settingsHash } = this.bind(override);
        return {
            planets: this.getPlanets(date, override),
            houses: this.getHouses(date, override),
            settingsHash,
        };
    }

    getPanchanga(date: DateTime, override?: SettingsInput): PanchangaResult & { settingsHash: string } {
        const { config: c, settingsHash } = this.bind(override);
        const planets = this.getPlanets(date, override);
        const sun  = planets.find(p => p.id === 0);
        const moon = planets.find(p => p.id === 1);
        if (!sun || !moon) throw new Error('Sun or Moon data missing');
        return { ...calculatePanchanga(sun.longitude, moon.longitude, date, c.sunriseHour), settingsHash };
    }

    /** Divisional chart for one longitude, honouring the configured varga rules. */
    getVarga(longitude: number, division: number, override?: SettingsInput): VargaPoint & { settingsHash: string } {
        const { config: c, settingsHash } = this.bind(override);
        return {
            ...calculateVarga(longitude, division, {
                dasamsaScheme: c.dasamsaScheme,
                horaScheme:    c.horaScheme,
            }),
            settingsHash,
        };
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
