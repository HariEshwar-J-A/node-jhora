import type { CalculationSettings, ResultEnvelope } from '@node-jhora/core';

/** Lazy section ids supported by {@link ChartSession}. */
export type ChartSectionId =
    | 'planets'
    | 'houses'
    | 'panchanga'
    | 'vargas'
    | 'dasha'
    | 'shadbala'
    | 'yogas'
    | 'ashtakavarga';

export const CHART_SECTION_IDS: readonly ChartSectionId[] = [
    'planets',
    'houses',
    'panchanga',
    'vargas',
    'dasha',
    'shadbala',
    'yogas',
    'ashtakavarga',
] as const;

export interface SerializablePlanet {
    id: number;
    name: string;
    longitude: number;
    latitude: number;
    speed: number;
    distance: number;
    declination: number;
    sign: number;
    degree: number;
}

export interface SerializableHouses {
    system: string;
    ascendant: number;
    mc: number;
    cusps: number[];
    armc?: number;
    vertex?: number;
}

export interface SerializableVargaPoint {
    planetId: number;
    planetName: string;
    sign: number;
    degree: number;
    longitude: number;
    deity?: string;
}

export interface SerializableDashaBalance {
    lord: string;
    yearsRemaining: number;
    totalDuration: number;
    fractionTraversed: number;
    nakshatraIndex: number;
}

export interface SerializableDashaPeriod {
    planet: string;
    level: number;
    start: string;
    end: string;
    durationYears: number;
    subPeriods: SerializableDashaPeriod[];
}

export interface SerializableShadbalaRow {
    planetId: number;
    planetName: string;
    rupas: number;
    virupas: number;
    components: Record<string, number>;
    breakdown: Record<string, number>;
    ishtaPhala: number;
    kashtaPhala: number;
}

export interface SerializableYogaHit {
    key: string;
    name: string;
    category: string;
    triggeringPlanets: string[];
}

export interface SerializableAshtakavarga {
    bav: Record<string, number[]>;
    sav: number[];
}

/**
 * Sections requested from {@link ChartSession.collect}, plus the core result
 * envelope (engineVersion, ephemerisProvider, tzdbVersion, deltaTModel, warnings).
 */
export interface ChartSectionsSnapshot extends Omit<ResultEnvelope, 'settingsHash'> {
    settingsHash: string;
    settings: CalculationSettings;
    planets?: SerializablePlanet[];
    houses?: SerializableHouses;
    panchanga?: import('@node-jhora/core').PanchangaResult;
    vargas?: Record<string, SerializableVargaPoint[]>;
    dasha?: {
        balance: SerializableDashaBalance;
        periods: SerializableDashaPeriod[];
    };
    shadbala?: SerializableShadbalaRow[];
    yogas?: SerializableYogaHit[];
    ashtakavarga?: SerializableAshtakavarga;
}

export interface ChartSessionDashaOptions {
    depth?: number;
    applyDasaYear?: boolean;
    dashaYearDays?: number;
}
