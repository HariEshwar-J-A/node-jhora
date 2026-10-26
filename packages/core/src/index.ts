import { DateTime } from 'luxon';

import { type JyotishConfig } from './config.js';
import {
    Body,
    BODY_ASHTAKAVARGA_LAGNA_DONOR,
    EPHEMERIS_BODIES,
    SEVEN_GRAHAS_JHORA_ORDER,
} from './core/body.js';
import { getRelationship, PLANET_IDS, Relationship } from './core/relationships.js';
import { EphemerisEngine, HouseData, PlanetPosition } from './engine/ephemeris.js';
import { AYANAMSA } from './engine/ephemeris.js';
import { CityData, Geocoder } from './engine/geocoder.js';
import { EphemerisInterpolator } from './engine/interpolator.js';
import { KPRuling, RulingPlanetsResult } from './kp/ruling.js';
import { KPSignificator, KPSubLord } from './kp/sublord.js';
import {
    type CalculationSettings,
    describeCalculation,
    isSettingsShape,
    type SettingsInput,
} from './settings/index.js';
import { PlanetaryStream, StreamConfig } from './stream/planetary_stream.js';
import { VargaDeities } from './vedic/deities.js';
import { calculateHouseCusps, HouseSystemMethod } from './vedic/houses.js';
import { calculatePanchanga, PanchangaResult } from './vedic/panchanga.js';
import {
    calculateBhavaLagna,
    calculateGhatiLagna,
    calculateHoraLagna,
    calculateInduLagna,
    calculatePranapada,
    calculateShreeLagna,
    calculateVarnadaLagna,
} from './vedic/special_lagnas.js';
import {
    calculateDhumadiUpagrahas,
    calculateTimeUpagrahas,
    UpagrahaPositions,
} from './vedic/upagrahas.js';
import { calculateShashtyamsa, calculateVarga, VargaPoint } from './vedic/vargas.js';

// Re-export Interfaces
export type {
    HouseData,
    HouseSystemMethod,
    KPSignificator,
    PanchangaResult,
    PlanetPosition,
    RulingPlanetsResult,
    UpagrahaPositions,
    VargaPoint,
};

// Re-export Utils
export { decimalToDms, dmsToDecimal, getShortestDistance, normalize360 } from './core/math.js';
export { D, DASHA_YEAR_DAYS, NAKSHATRA_SPAN_D, normalize360D, toNum } from './core/precise.js';
export {
    Body,
    BODY_ASHTAKAVARGA_LAGNA_DONOR,
    calculateShashtyamsa,
    calculateVarga,
    EPHEMERIS_BODIES,
    getRelationship,
    PLANET_IDS,
    Relationship,
    SEVEN_GRAHAS_JHORA_ORDER,
    VargaDeities,
};
export type { HouseSystem, JyotishConfig, NodeType } from './config.js';
export { DEFAULT_CONFIG, JHORA_PRESET, resolveConfig, TROPICAL_YEAR_DAYS } from './config.js';
export { AYANAMSA_MODELS, ayanamsaName } from './engine/ayanamsa.js';
export {
    DELTA_T_MODEL_MODERN,
    deltaTModelId,
    LAST_OBSERVED_YEAR_MODERN,
    lastObservedDeltaTYear,
} from './engine/deltat.js';
export type { AyanamsaMode, PositionMode } from './engine/ephemeris.js';
export type { PrecisionOptions } from './engine/ephemeris.js';
export {
    AYANAMSA,
    DEFAULT_AYANAMSA,
    DEFAULT_NODE_TYPE,
    DEFAULT_POSITION_MODE,
} from './engine/ephemeris.js';
export type { ChunkKey, EphemerisChunkLoader } from './engine/provider/index.js';
export type {
    EphemerisPolicy,
    EphemerisProvenance,
    EphemerisProvider,
} from './engine/provider/index.js';
export {
    CachingChunkLoader,
    CompositeEphemerisProvider,
    De431ChunkFile,
    De431ChunkStore,
    DE440S_JD_TDB_END,
    DE440S_JD_TDB_START,
    fetchChunkLoader,
    nodeFsChunkLoader,
} from './engine/provider/index.js';
export type {
    PrecisionProfile,
    ResultEnvelope,
    ResultEnvelopeOptions,
    SettingsHashValue,
    WithResultEnvelopeOptions,
} from './envelope.js';
export {
    createResultEnvelope,
    DEFAULT_PRECISION_PROFILE,
    DELTA_T_MODEL,
    EPHEMERIS_PROVIDER,
    withResultEnvelope,
} from './envelope.js';
export type {
    EphemerisFileEntry,
    NjceChunkEntry,
    VerifyingChunkLoaderOptions,
} from './ephemeris-data/index.js';
export {
    DE431_SOURCE,
    DE440S_DATA_VERSION,
    DE440S_ENTRY,
    DE440S_PRIMARY_URLS,
    de440sCdnUrl,
    EphemerisIntegrityError,
    firstAvailableChunkLoader,
    NJCE_DATA_VERSION,
    NJCE_MAX_CENTURY,
    NJCE_MIN_CENTURY,
    NJCE_PACKAGE_SPAN_CENTURIES,
    njceCdnUrl,
    njceChunkEntries,
    njceChunkEntry,
    njceFileName,
    njcePackageName,
    njcePackageStartYear,
    sha256HexAsync,
    verifyEphemerisBytes,
    verifyingChunkLoader,
} from './ephemeris-data/index.js';
export { ENGINE_VERSION, TZDB_VERSION } from './generated/build-constants.js';
export type {
    AyanamsaId,
    CalculationSettings,
    DasaYearKind,
    EphemerisPolicyId,
    HouseSystemId,
    PrecisionProfileId,
    PresetId,
    ResolvedCalculation,
    SettingsInput,
    SunriseLimb,
} from './settings/index.js';
export {
    AYANAMSA_IDS,
    AYANAMSA_MODE_BY_ID,
    CalculationSettingsSchema,
    canonicalJson,
    DASA_YEAR_KINDS,
    describeCalculation,
    EPHEMERIS_POLICIES,
    expandCalculationBody,
    expandRequestBody,
    flatFromSettings,
    getPreset,
    hashSettings,
    HOUSE_SYSTEM_IDS,
    inferDasaYearKind,
    isPresetId,
    isSettingsShape,
    LEGACY_DASHA_YEAR_DAYS,
    LEGACY_DASHA_YEAR_DAYS_TEXT,
    PRECISION_PROFILES,
    PRESET_IDS,
    PRESETS,
    resolveCalculationInput,
    SETTINGS_HASH_HEX_LENGTH,
    settingsFromFlat,
    settingsToJyotishConfig,
    SUNRISE_LIMBS,
} from './settings/index.js';
export type { HistoricalDateTime } from './time/historical.js';
export {
    civilDateFromJulianDay,
    julianDayUt,
    parseHistoricalDateString,
    parseHistoricalTimeString,
    usesProlepticJulian,
} from './time/historical.js';
export type {
    AmbiguousLocalPolicy,
    CivilTimeInput,
    CivilTimePolicy,
    CivilTimeResult,
    CivilTimeWarning,
    GapLocalPolicy,
    LocalClock,
    ManualOffsetOverride,
    TzResolutionStep,
    TzResolutionStepCode,
    TzResolutionTrace,
} from './time/index.js';
export {
    CIVIL_YEAR_MAX,
    CIVIL_YEAR_MIN,
    formatUtcIso,
    getTzdbVersion,
    isValidIanaTimeZone,
    julianDayToUnixMs,
    localClockToHourUT,
    localClockToJulianDay,
    resolveCivilTime,
    unixMsToJulianDay,
} from './time/index.js';
export type { DasamsaScheme, HoraScheme, VargaOptions } from './vedic/vargas.js';
export { DEFAULT_DASAMSA_SCHEME, DEFAULT_HORA_SCHEME } from './vedic/vargas.js';

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
    | 'TrueChitra'
    | 'TruePushya'
    | 'TrueRevati'
    | 'TrueMula'
    | 'Lahiri'
    | 'LahiriICRC'
    | 'Raman'
    | 'KP'
    | 'Yukteshwar'
    | 'FaganBradley';

const AYANAMSA_BY_NAME: Record<Ayanamsa, number> = {
    TrueChitra: AYANAMSA.TRUE_CITRA,
    TruePushya: AYANAMSA.TRUE_PUSHYA,
    TrueRevati: AYANAMSA.TRUE_REVATI,
    TrueMula: AYANAMSA.TRUE_MULA,
    Lahiri: AYANAMSA.LAHIRI,
    LahiriICRC: AYANAMSA.LAHIRI_ICRC,
    Raman: AYANAMSA.RAMAN,
    KP: AYANAMSA.KRISHNAMURTI,
    Yukteshwar: AYANAMSA.YUKTESHWAR,
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
    private location: { latitude: number; longitude: number; altitude?: number };
    /** Instance defaults. Every method accepts a per-call override. */
    public readonly config: JyotishConfig;
    /** Validated settings bundle. Legacy config objects are mapped onto this. */
    public readonly settings: CalculationSettings;
    /** {@link hashSettings} of {@link settings}. */
    public readonly settingsHash: string;

    constructor(
        location: { latitude: number; longitude: number; altitude?: number },
        config: SettingsInput = {},
    ) {
        this.location = location;
        this.ephemeris = EphemerisEngine.getInstance();
        const resolved = describeCalculation(config);
        this.ephemeris.setEphemerisPolicy(resolved.settings.ephemerisPolicy);
        this.config = resolved.config;
        this.settings = resolved.settings;
        this.settingsHash = resolved.settingsHash;
    }

    /** Resolve a per-call override against this instance's defaults. */
    private bind(override?: SettingsInput) {
        if (override === undefined) {
            return {
                config: this.config,
                settings: this.settings,
                settingsHash: this.settingsHash,
            };
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
        location: { latitude: number; longitude: number; altitude?: number },
        ayanamsaName: Ayanamsa = 'TrueChitra',
        config: SettingsInput = {},
    ): Promise<ChartData & { panchanga: PanchangaResult; settingsHash: string }> {
        // A preset id or a settings object replaces the name. A legacy config
        // still lets an explicit mode win over the name, as before.
        const requested: SettingsInput =
            typeof config === 'string' || isSettingsShape(config)
                ? config
                : {
                      ayanamsaMode:
                          config.ayanamsaMode ??
                          config.ayanamsaOrder ??
                          AYANAMSA_BY_NAME[ayanamsaName],
                      ...config,
                  };
        const { config: c, settingsHash, settings } = describeCalculation(requested);

        const engine = EphemerisEngine.getInstance();
        engine.setEphemerisPolicy(settings.ephemerisPolicy);
        await engine.initialize();

        const dt = DateTime.fromJSDate(date);
        const planets = engine.getPlanets(
            dt,
            { ...location, altitude: location.altitude ?? c.altitudeMetres },
            {
                ayanamsaOrder: c.ayanamsaMode,
                ayanamsaOffset: c.ayanamsaOffset,
                topocentric: c.topocentric,
                nodeType: c.nodeType,
                positionMode: c.positionMode,
                precisionProfile: c.precisionProfile,
                deltaTOverrideSeconds: c.deltaTOverrideSeconds,
            },
        );
        const housesResult = calculateHouseCusps(
            dt,
            location.latitude,
            location.longitude,
            c.houseSystem as HouseSystemMethod,
            engine,
            c.ayanamsaMode,
            c.ayanamsaOffset,
            {
                precisionProfile: c.precisionProfile,
                deltaTOverrideSeconds: c.deltaTOverrideSeconds,
            },
        );

        const sun = planets.find((p) => p.id === Body.Sun);
        const moon = planets.find((p) => p.id === Body.Moon);
        let panchanga: any = null;
        if (sun && moon) {
            panchanga = calculatePanchanga(sun.longitude, moon.longitude, dt, c.sunriseHour);
        }

        const houses: HouseData = {
            cusps: housesResult.cusps,
            ascendant: housesResult.ascendant,
            mc: housesResult.mc,
            armc: housesResult.armc,
            vertex: housesResult.vertex || 0,
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
                ayanamsaOrder: c.ayanamsaMode,
                ayanamsaOffset: c.ayanamsaOffset,
                topocentric: c.topocentric,
                nodeType: c.nodeType,
                positionMode: c.positionMode,
                precisionProfile: c.precisionProfile,
                deltaTOverrideSeconds: c.deltaTOverrideSeconds,
            },
        );
    }

    getHouses(date: DateTime, override?: SettingsInput): HouseData & { settingsHash: string } {
        const { config: c, settingsHash } = this.bind(override);
        const res = calculateHouseCusps(
            date,
            this.location.latitude,
            this.location.longitude,
            c.houseSystem as HouseSystemMethod,
            this.ephemeris,
            c.ayanamsaMode,
            c.ayanamsaOffset,
            {
                precisionProfile: c.precisionProfile,
                deltaTOverrideSeconds: c.deltaTOverrideSeconds,
            },
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

    getChart(
        date: DateTime,
        override?: SettingsInput,
    ): { planets: PlanetPosition[]; houses: HouseData; settingsHash: string } {
        const { settingsHash } = this.bind(override);
        return {
            planets: this.getPlanets(date, override),
            houses: this.getHouses(date, override),
            settingsHash,
        };
    }

    getPanchanga(
        date: DateTime,
        override?: SettingsInput,
    ): PanchangaResult & { settingsHash: string } {
        const { config: c, settingsHash } = this.bind(override);
        const planets = this.getPlanets(date, override);
        const sun = planets.find((p) => p.id === Body.Sun);
        const moon = planets.find((p) => p.id === Body.Moon);
        if (!sun || !moon) throw new Error('Sun or Moon data missing');
        return {
            ...calculatePanchanga(sun.longitude, moon.longitude, date, c.sunriseHour),
            settingsHash,
        };
    }

    /** Divisional chart for one longitude, honouring the configured varga rules. */
    getVarga(
        longitude: number,
        division: number,
        override?: SettingsInput,
    ): VargaPoint & { settingsHash: string } {
        const { config: c, settingsHash } = this.bind(override);
        return {
            ...calculateVarga(longitude, division, {
                dasamsaScheme: c.dasamsaScheme,
                horaScheme: c.horaScheme,
            }),
            settingsHash,
        };
    }
}

// Functional Exports (Browser-safe only)
export {
    calculateBhavaLagna,
    calculateDhumadiUpagrahas,
    calculateGhatiLagna,
    calculateHoraLagna,
    calculateHouseCusps,
    calculateInduLagna,
    calculatePanchanga,
    calculatePranapada,
    calculateShreeLagna,
    calculateTimeUpagrahas,
    calculateVarnadaLagna,
    EphemerisEngine,
    KPRuling,
    KPSubLord,
};
