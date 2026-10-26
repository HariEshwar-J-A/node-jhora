import { Ashtakavarga, YOGA_LIBRARY, YogaEngine } from '@node-jhora/analytics';
import {
    Body,
    BODY_ASHTAKAVARGA_LAGNA_DONOR,
    calculateHouseCusps,
    calculatePanchanga,
    calculateVarga,
    createResultEnvelope,
    describeCalculation,
    type EphemerisEngine,
    type HouseSystemMethod,
    type PanchangaResult,
    type PlanetPosition,
    type SettingsInput,
} from '@node-jhora/core';
import {
    calculateDashaBalance,
    type DashaPeriod,
    generateVimshottari,
} from '@node-jhora/prediction';
import { DateTime } from 'luxon';

import { computeShadbalaSection } from './sections/shadbala.js';
import type {
    ChartSectionId,
    ChartSectionsSnapshot,
    ChartSessionDashaOptions,
    SerializableAshtakavarga,
    SerializableDashaPeriod,
    SerializableHouses,
    SerializablePlanet,
    SerializableVargaPoint,
    SerializableYogaHit,
} from './types.js';

const VARGA_DIVISIONS = [1, 2, 3, 4, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60];

/** Injectable core helpers (used in unit tests to count lazy section work). */
export interface ChartSessionDeps {
    calculateHouseCusps: typeof calculateHouseCusps;
    calculatePanchanga: typeof calculatePanchanga;
    calculateVarga: typeof calculateVarga;
}

const defaultDeps: ChartSessionDeps = {
    calculateHouseCusps,
    calculatePanchanga,
    calculateVarga,
};

export interface ChartSessionInput {
    instant: DateTime;
    /** When set, used instead of deriving JD from `instant` (civil-time resolver). */
    julianDayUt?: number;
    location: { latitude: number; longitude: number; altitude?: number };
    settings: SettingsInput;
    ephemeris: EphemerisEngine;
    dasha?: ChartSessionDashaOptions;
    /**
     * Optional house-system label as passed by HTTP (`whole_sign`) or legacy config (`WholeSign`).
     * When omitted, {@link describeCalculation} → `config.houseSystem` is used.
     */
    houseSystemOverride?: HouseSystemMethod | string;
    deps?: Partial<ChartSessionDeps>;
}

function serializePlanet(p: PlanetPosition): SerializablePlanet {
    return {
        id: p.id,
        name: p.name,
        longitude: p.longitude,
        latitude: p.latitude,
        speed: p.speed,
        distance: p.distance,
        declination: p.declination,
        sign: Math.floor(p.longitude / 30) + 1,
        degree: p.longitude % 30,
    };
}

function serializeDashaPeriod(p: DashaPeriod): SerializableDashaPeriod {
    return {
        planet: p.planet,
        level: p.level,
        start: p.start.toISO()!,
        end: p.end.toISO()!,
        durationYears: p.durationYears,
        subPeriods: (p.subPeriods ?? []).map(serializeDashaPeriod),
    };
}

/**
 * Lazy, memoised chart computation facade for API, workers, and UI.
 * Sections are pure data suitable for `structuredClone` / JSON.
 */
export class ChartSession {
    readonly settingsHash: string;
    readonly settings: ReturnType<typeof describeCalculation>['settings'];
    readonly config: ReturnType<typeof describeCalculation>['config'];

    private readonly instant: DateTime;
    private readonly julianDayUt?: number;
    private readonly location: ChartSessionInput['location'];
    private readonly ephemeris: EphemerisEngine;
    private readonly dashaOpts: ChartSessionDashaOptions;
    private readonly houseSystemOverride?: HouseSystemMethod | string;
    private readonly deps: ChartSessionDeps;

    private rawPlanets?: PlanetPosition[];
    private planetsOut?: SerializablePlanet[];
    private housesOut?: SerializableHouses;
    private panchangaOut?: PanchangaResult;
    private vargasOut?: Record<string, SerializableVargaPoint[]>;
    private dashaOut?: ChartSectionsSnapshot['dasha'];
    private shadbalaOut?: ChartSectionsSnapshot['shadbala'];
    private yogasOut?: SerializableYogaHit[];
    private ashtakavargaOut?: SerializableAshtakavarga;

    constructor(input: ChartSessionInput) {
        const resolved = describeCalculation(input.settings);
        this.settings = resolved.settings;
        this.settingsHash = resolved.settingsHash;
        this.config = resolved.config;
        this.instant = input.instant;
        this.julianDayUt = input.julianDayUt;
        this.location = input.location;
        this.ephemeris = input.ephemeris;
        this.dashaOpts = input.dasha ?? {};
        this.houseSystemOverride = input.houseSystemOverride;
        this.deps = { ...defaultDeps, ...input.deps };
    }

    private ephemerisOpts() {
        return {
            ayanamsaOrder: this.config.ayanamsaMode,
            nodeType: this.config.nodeType,
            positionMode: this.config.positionMode,
            topocentric: this.config.topocentric,
            ayanamsaOffset: this.config.ayanamsaOffset,
            calendar: this.config.calendar,
            ...(this.julianDayUt !== undefined ? { julianDayUt: this.julianDayUt } : {}),
        };
    }

    private loadRawPlanets(): PlanetPosition[] {
        if (!this.rawPlanets) {
            this.rawPlanets = this.ephemeris.getPlanets(
                this.instant,
                this.location,
                this.ephemerisOpts(),
            );
        }
        return this.rawPlanets;
    }

    getPlanets(): SerializablePlanet[] {
        if (!this.planetsOut) {
            this.planetsOut = this.loadRawPlanets().map(serializePlanet);
        }
        return this.planetsOut;
    }

    getHouses(): SerializableHouses {
        if (!this.housesOut) {
            const method = (this.houseSystemOverride ??
                this.config.houseSystem) as HouseSystemMethod;
            const result = this.deps.calculateHouseCusps(
                this.instant,
                this.location.latitude,
                this.location.longitude,
                method,
                this.ephemeris,
                this.config.ayanamsaMode,
                this.config.ayanamsaOffset,
                {
                    calendar: this.config.calendar,
                    julianDayUt: this.julianDayUt,
                },
            );
            this.housesOut = {
                system: result.system,
                ascendant: result.ascendant,
                mc: result.mc,
                cusps: result.cusps,
                armc: result.armc,
                vertex: result.vertex,
            };
        }
        return this.housesOut;
    }

    getPanchanga(): PanchangaResult {
        if (!this.panchangaOut) {
            const raw = this.loadRawPlanets();
            const sun = raw.find((p) => p.id === Body.Sun)!;
            const moon = raw.find((p) => p.id === Body.Moon)!;
            this.panchangaOut = this.deps.calculatePanchanga(
                sun.longitude,
                moon.longitude,
                this.instant,
                this.config.sunriseHour,
            );
        }
        return this.panchangaOut;
    }

    getVargas(): Record<string, SerializableVargaPoint[]> {
        if (!this.vargasOut) {
            const raw = this.loadRawPlanets();
            const vargaOptions = {
                dasamsaScheme: this.config.dasamsaScheme,
                horaScheme: this.config.horaScheme,
            };
            const out: Record<string, SerializableVargaPoint[]> = {};
            for (const d of VARGA_DIVISIONS) {
                out[`D${d}`] = raw.map((p) => {
                    const v = this.deps.calculateVarga(p.longitude, d, vargaOptions);
                    return {
                        planetId: p.id,
                        planetName: p.name,
                        sign: v.sign,
                        degree: v.degree,
                        longitude: v.longitude,
                        ...(v.deity ? { deity: v.deity } : {}),
                    };
                });
            }
            this.vargasOut = out;
        }
        return this.vargasOut;
    }

    getDasha(): NonNullable<ChartSectionsSnapshot['dasha']> {
        if (!this.dashaOut) {
            const moon = this.loadRawPlanets().find((p) => p.id === Body.Moon)!;
            const balance = calculateDashaBalance(moon.longitude);
            const depth = this.dashaOpts.depth ?? 2;
            const yearDays =
                this.dashaOpts.applyDasaYear && this.dashaOpts.dashaYearDays != null
                    ? this.dashaOpts.dashaYearDays
                    : undefined;
            const periods = generateVimshottari(
                this.instant,
                moon.longitude,
                depth,
                yearDays != null ? { yearDays } : undefined,
            );
            this.dashaOut = {
                balance: {
                    lord: balance.lord,
                    yearsRemaining: balance.yearsRemaining,
                    totalDuration: balance.totalDuration,
                    fractionTraversed: balance.fractionTraversed,
                    nakshatraIndex: balance.nakshatraIndex,
                },
                periods: periods.map(serializeDashaPeriod),
            };
        }
        return this.dashaOut;
    }

    getShadbala(): ChartSectionsSnapshot['shadbala'] {
        if (!this.shadbalaOut) {
            const raw = this.loadRawPlanets();
            const houses = this.getHouses();
            const birthHour =
                this.instant.hour + this.instant.minute / 60 + this.instant.second / 3600;
            this.shadbalaOut = computeShadbalaSection(
                raw,
                {
                    cusps: houses.cusps,
                    ascendant: houses.ascendant,
                    mc: houses.mc,
                    armc: houses.armc ?? 0,
                    vertex: houses.vertex,
                },
                birthHour,
                this.location.latitude,
            );
        }
        return this.shadbalaOut;
    }

    getYogas(): SerializableYogaHit[] {
        if (!this.yogasOut) {
            const raw = this.loadRawPlanets();
            const houses = this.getHouses();
            const hits = YogaEngine.findYogas(
                { planets: raw, cusps: houses.cusps, ascendant: houses.ascendant },
                YOGA_LIBRARY,
            );
            this.yogasOut = hits.map((h) => ({
                key: h.yoga.key,
                name: h.yoga.name,
                category: h.yoga.category,
                triggeringPlanets: h.triggeringPlanets,
            }));
        }
        return this.yogasOut;
    }

    getAshtakavarga(): SerializableAshtakavarga {
        if (!this.ashtakavargaOut) {
            const raw = this.loadRawPlanets();
            const houses = this.getHouses();
            const withLagna: PlanetPosition[] = [
                ...raw,
                {
                    id: BODY_ASHTAKAVARGA_LAGNA_DONOR,
                    name: 'Ascendant',
                    longitude: houses.ascendant,
                    latitude: 0,
                    speed: 0,
                    distance: 0,
                    declination: 0,
                },
            ];
            const { bav, sav } = Ashtakavarga.calculateSAV(withLagna);
            const bavPlain: Record<string, number[]> = {};
            for (const [id, scores] of Object.entries(bav)) {
                bavPlain[String(id)] = [...scores];
            }
            this.ashtakavargaOut = { bav: bavPlain, sav: [...sav] };
        }
        return this.ashtakavargaOut;
    }

    getSection(id: ChartSectionId): unknown {
        switch (id) {
            case 'planets':
                return this.getPlanets();
            case 'houses':
                return this.getHouses();
            case 'panchanga':
                return this.getPanchanga();
            case 'vargas':
                return this.getVargas();
            case 'dasha':
                return this.getDasha();
            case 'shadbala':
                return this.getShadbala();
            case 'yogas':
                return this.getYogas();
            case 'ashtakavarga':
                return this.getAshtakavarga();
            default: {
                const _exhaustive: never = id;
                return _exhaustive;
            }
        }
    }

    /**
     * Materialise only the requested sections. Unrequested work is not run.
     * The snapshot carries the core result envelope; `computedAt` is omitted so
     * output stays deterministic.
     */
    collect(include: readonly ChartSectionId[]): ChartSectionsSnapshot {
        const { settingsHash: _hash, ...envelope } = createResultEnvelope({
            settingsHash: this.settingsHash,
        });
        const snapshot: ChartSectionsSnapshot = {
            settingsHash: this.settingsHash,
            settings: this.settings,
            ...envelope,
        };
        for (const id of include) {
            switch (id) {
                case 'planets':
                    snapshot.planets = this.getPlanets();
                    break;
                case 'houses':
                    snapshot.houses = this.getHouses();
                    break;
                case 'panchanga':
                    snapshot.panchanga = this.getPanchanga();
                    break;
                case 'vargas':
                    snapshot.vargas = this.getVargas();
                    break;
                case 'dasha':
                    snapshot.dasha = this.getDasha();
                    break;
                case 'shadbala':
                    snapshot.shadbala = this.getShadbala();
                    break;
                case 'yogas':
                    snapshot.yogas = this.getYogas();
                    break;
                case 'ashtakavarga':
                    snapshot.ashtakavarga = this.getAshtakavarga();
                    break;
                default:
                    break;
            }
        }
        return snapshot;
    }

    /** Prove clone-friendliness for worker postMessage. */
    toJSON(): ChartSectionsSnapshot {
        return this.collect([
            'planets',
            'houses',
            'panchanga',
            'vargas',
            'dasha',
            'shadbala',
            'yogas',
            'ashtakavarga',
        ]);
    }
}
