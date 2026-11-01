/**
 * Turn a preset id, a settings object, or the existing config fields into
 * one validated settings bundle and the legacy {@link JyotishConfig} the
 * engine already reads.
 */

import {
    type HouseSystem,
    type JyotishConfig,
    resolveConfig,
    TROPICAL_YEAR_DAYS,
} from '../config.js';
import type { AyanamsaOptions } from '../engine/ayanamsa-options.js';
import { AYANAMSA_MODE_USER } from '../engine/ayanamsa-options.js';
import {
    houseSystemIdFromLegacy,
    houseSystemLegacyFromId,
    isHouseSystemId,
} from '../engine/house-registry.js';
import { NodeJHoraError, NodeJHoraErrorCode } from '../errors.js';
import { assertAyanamsaMode } from '../validation/input.js';
import { hashSettings } from './hash.js';
import { normalizeCalculationSettings } from './normalize.js';
import { getPreset, isPresetId, type PresetId } from './presets.js';
import {
    AYANAMSA_MODE_BY_ID,
    type AyanamsaId,
    ayanamsaIdForMode,
    type CalculationSettings,
    CalculationSettingsSchema,
    type DasaYearKind,
    type HouseAnchorId,
    type HouseSystemId,
    inferDasaYearKind,
    type SunriseLimb,
} from './schema.js';

/** Fields accepted before this schema existed. `ayanamsaOrder` is the old alias. */
export interface LegacyCalculationInput {
    positionMode?: JyotishConfig['positionMode'];
    topocentric?: boolean;
    altitudeMetres?: number;
    ayanamsaMode?: number;
    ayanamsaOrder?: number;
    ayanamsaOffset?: number;
    nodeType?: JyotishConfig['nodeType'];
    houseSystem?: HouseSystem;
    dasamsaScheme?: JyotishConfig['dasamsaScheme'];
    horaScheme?: JyotishConfig['horaScheme'];
    sunriseHour?: number;
    dashaYearDays?: number;
    /** Same role as a preset id argument, then the other fields override it. */
    preset?: string;
}

export type SettingsInput = PresetId | Partial<CalculationSettings> | LegacyCalculationInput;

const SETTINGS_MARKS = [
    'schemaVersion',
    'ephemerisPolicy',
    'calendar',
    'ayanamsa',
    'ayanamsaOffsetDeg',
    'dasaYear',
    'vargaVariants',
    'cuspsInMiddle',
    'houseAnchor',
    'customAyanamsaMode',
    'ayanamsaFlags',
    'userAyanamsa',
    'deltaTForecast',
    'starParallax',
] as const;

export function isSettingsShape(value: object): value is Partial<CalculationSettings> {
    const record = value as Record<string, unknown>;
    if (SETTINGS_MARKS.some((key) => record[key] !== undefined)) return true;
    if (record.sunrise !== undefined && typeof record.sunrise === 'object') return true;
    const house = record.houseSystem;
    return typeof house === 'string' && isHouseSystemId(house);
}

export interface ResolvedCalculation {
    settings: CalculationSettings;
    settingsHash: string;
    config: JyotishConfig;
}

function ayanamsaOptionsFromSettings(
    settings: CalculationSettings,
    mode: number,
): AyanamsaOptions | undefined {
    const ayanamsaFlags = settings.ayanamsaFlags;
    const user = settings.userAyanamsa;
    if (ayanamsaFlags === undefined && user === undefined && mode !== AYANAMSA_MODE_USER) {
        return undefined;
    }
    const options: AyanamsaOptions = {};
    if (ayanamsaFlags !== undefined) options.ayanamsaFlags = ayanamsaFlags;
    if (user !== undefined) {
        options.user = {
            t0Jd: user.t0Jd,
            ayanamsaDeg: user.ayanamsaDeg,
            ...(user.t0IsUt !== undefined ? { t0IsUt: user.t0IsUt } : {}),
        };
    }
    return options;
}

export function settingsToJyotishConfig(settings: CalculationSettings): JyotishConfig {
    const mode = settings.customAyanamsaMode ?? AYANAMSA_MODE_BY_ID[settings.ayanamsa];
    const ayanamsaOptions = ayanamsaOptionsFromSettings(settings, mode);
    return {
        positionMode: settings.positionMode,
        topocentric: settings.topocentric,
        altitudeMetres: settings.altitudeMetres,
        ayanamsaMode: mode,
        ayanamsaOffset: settings.ayanamsaOffsetDeg,
        ...(ayanamsaOptions ? { ayanamsaOptions } : {}),
        nodeType: settings.nodeType,
        houseSystem: houseSystemLegacyFromId(settings.houseSystem),
        houseAnchor: settings.houseAnchor ?? 'ascendant',
        cuspsInMiddle: settings.cuspsInMiddle,
        dasamsaScheme: settings.dasamsaScheme,
        horaScheme: settings.horaScheme,
        sunriseHour: settings.sunrise.nominalHour,
        dashaYearDays: settings.dasaYear.days,
        ...(settings.precisionProfile !== 'jhora'
            ? { precisionProfile: settings.precisionProfile }
            : {}),
        ...(settings.deltaTOverrideSeconds !== undefined
            ? { deltaTOverrideSeconds: settings.deltaTOverrideSeconds }
            : {}),
        ...(settings.deltaTForecast === 'oracle-compat'
            ? { deltaTForecast: settings.deltaTForecast }
            : {}),
        ...(settings.starParallax === 'continuous' ? { starParallax: settings.starParallax } : {}),
        ...(settings.calendar !== undefined && settings.calendar !== 'auto'
            ? { calendar: settings.calendar }
            : {}),
    };
}

export function jyotishConfigToSettings(
    config: JyotishConfig,
    base: CalculationSettings = getPreset('node-jhora-default'),
): CalculationSettings {
    const known = ayanamsaIdForMode(config.ayanamsaMode);
    return parseSettings({
        schemaVersion: 1,
        precisionProfile: config.precisionProfile ?? base.precisionProfile,
        ...(config.deltaTOverrideSeconds !== undefined
            ? { deltaTOverrideSeconds: config.deltaTOverrideSeconds }
            : {}),
        ...(config.deltaTForecast === 'oracle-compat'
            ? { deltaTForecast: config.deltaTForecast }
            : {}),
        ...(config.starParallax === 'continuous' ? { starParallax: config.starParallax } : {}),
        ...(config.calendar !== undefined && config.calendar !== 'auto'
            ? { calendar: config.calendar }
            : {}),
        ayanamsa: known ?? base.ayanamsa,
        ayanamsaOffsetDeg: config.ayanamsaOffset,
        ...(known ? {} : { customAyanamsaMode: config.ayanamsaMode }),
        nodeType: config.nodeType,
        houseSystem: houseSystemIdFromLegacy(config.houseSystem),
        houseAnchor: config.houseAnchor ?? base.houseAnchor ?? 'ascendant',
        cuspsInMiddle: config.cuspsInMiddle ?? base.cuspsInMiddle,
        positionMode: config.positionMode,
        topocentric: config.topocentric,
        altitudeMetres: config.altitudeMetres,
        sunrise: { ...base.sunrise, nominalHour: config.sunriseHour },
        dasaYear:
            config.dashaYearDays === base.dasaYear.days
                ? base.dasaYear
                : { kind: inferDasaYearKind(config.dashaYearDays), days: config.dashaYearDays },
        dasamsaScheme: config.dasamsaScheme,
        horaScheme: config.horaScheme,
        vargaVariants: {
            ...base.vargaVariants,
            d2: config.horaScheme,
            d10: config.dasamsaScheme,
        },
    });
}

function parseSettings(input: unknown): CalculationSettings {
    try {
        return CalculationSettingsSchema.parse(input);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new NodeJHoraError(NodeJHoraErrorCode.INVALID_INPUT, message);
    }
}

function assertResolvableAyanamsa(settings: CalculationSettings): void {
    const mode = settings.customAyanamsaMode ?? AYANAMSA_MODE_BY_ID[settings.ayanamsa];
    assertAyanamsaMode(mode);
}

function mergeSettings(
    base: CalculationSettings,
    patch: Partial<CalculationSettings>,
): CalculationSettings {
    const merged = normalizeCalculationSettings(
        parseSettings({
            ...base,
            ...patch,
            schemaVersion: 1,
            sunrise: { ...base.sunrise, ...patch.sunrise },
            dasaYear: { ...base.dasaYear, ...patch.dasaYear },
            vargaVariants: { ...base.vargaVariants, ...patch.vargaVariants },
        }),
    );
    assertResolvableAyanamsa(merged);
    return merged;
}

export function resolveCalculationInput(
    input: SettingsInput = {},
    base: CalculationSettings = getPreset('node-jhora-default'),
): CalculationSettings {
    if (typeof input === 'string') {
        if (!isPresetId(input)) {
            throw new NodeJHoraError(
                NodeJHoraErrorCode.INVALID_INPUT,
                `Unknown calculation preset: ${input}`,
            );
        }
        return getPreset(input);
    }

    const record = input as LegacyCalculationInput & Partial<CalculationSettings>;
    if (typeof record.preset === 'string') {
        if (!isPresetId(record.preset)) {
            throw new NodeJHoraError(
                NodeJHoraErrorCode.INVALID_INPUT,
                `Unknown calculation preset: ${record.preset}`,
            );
        }
        const { preset: _preset, ...rest } = record;
        return resolveCalculationInput(rest, getPreset(record.preset));
    }

    if (isSettingsShape(input)) return mergeSettings(base, input);

    const legacy = input as LegacyCalculationInput;
    const { ayanamsaOrder, ...rest } = legacy;
    const config = resolveConfig(
        { ...rest, ayanamsaMode: rest.ayanamsaMode ?? ayanamsaOrder },
        settingsToJyotishConfig(base),
    );
    const settings = jyotishConfigToSettings(config, base);
    assertResolvableAyanamsa(settings);
    return settings;
}

export function describeCalculation(
    input: SettingsInput = {},
    base?: CalculationSettings,
): ResolvedCalculation {
    const settings = base ? resolveCalculationInput(input, base) : resolveCalculationInput(input);
    return {
        settings,
        settingsHash: hashSettings(settings),
        config: settingsToJyotishConfig(settings),
    };
}

export interface FlatBirthSettings {
    calendar?: CalculationSettings['calendar'];
    ayanamsa: AyanamsaId;
    ayanamsaOffsetDeg: number;
    nodeType: CalculationSettings['nodeType'];
    houseSystem: HouseSystemId;
    houseAnchor?: HouseAnchorId;
    cuspsInMiddle?: boolean;
    positionMode: CalculationSettings['positionMode'];
    topocentric: boolean;
    altitudeMetres: number;
    sunriseLimb?: SunriseLimb;
    sunriseRefraction?: boolean;
    nominalHour: number;
    dasaYearKind?: DasaYearKind;
    dasaYearDays?: number;
    dasamsaScheme: CalculationSettings['dasamsaScheme'];
    horaScheme: CalculationSettings['horaScheme'];
    vargaVariants?: Record<string, string>;
    customAyanamsaMode?: number;
}

/** Rebuild a settings object from the flat fields a request carries after validation. */
export function settingsFromFlat(fields: FlatBirthSettings): CalculationSettings {
    const days = fields.dasaYearDays ?? TROPICAL_YEAR_DAYS;
    return parseSettings({
        schemaVersion: 1,
        ...(fields.calendar !== undefined && fields.calendar !== 'auto'
            ? { calendar: fields.calendar }
            : {}),
        ayanamsa: fields.ayanamsa,
        ayanamsaOffsetDeg: fields.ayanamsaOffsetDeg,
        ...(fields.customAyanamsaMode !== undefined
            ? { customAyanamsaMode: fields.customAyanamsaMode }
            : {}),
        nodeType: fields.nodeType,
        houseSystem: fields.houseSystem,
        houseAnchor: fields.houseAnchor ?? 'ascendant',
        cuspsInMiddle: fields.cuspsInMiddle ?? false,
        positionMode: fields.positionMode,
        topocentric: fields.topocentric,
        altitudeMetres: fields.altitudeMetres,
        sunrise: {
            limb: fields.sunriseLimb ?? 'disc_centre',
            refraction: fields.sunriseRefraction ?? false,
            nominalHour: fields.nominalHour,
        },
        dasaYear: { kind: fields.dasaYearKind ?? inferDasaYearKind(days), days },
        dasamsaScheme: fields.dasamsaScheme,
        horaScheme: fields.horaScheme,
        vargaVariants: fields.vargaVariants ?? { d2: fields.horaScheme, d10: fields.dasamsaScheme },
    });
}

export function flatFromSettings(settings: CalculationSettings): Record<string, unknown> {
    return {
        ...(settings.calendar !== undefined && settings.calendar !== 'auto'
            ? { calendar: settings.calendar }
            : {}),
        ayanamsa: settings.ayanamsa,
        ayanamsaOffset: settings.ayanamsaOffsetDeg,
        ...(settings.customAyanamsaMode !== undefined
            ? { customAyanamsaMode: settings.customAyanamsaMode }
            : {}),
        nodeType: settings.nodeType,
        houseSystem: settings.houseSystem,
        houseAnchor: settings.houseAnchor,
        cuspsInMiddle: settings.cuspsInMiddle,
        positionMode: settings.positionMode,
        topocentric: settings.topocentric,
        altitudeMetres: settings.altitudeMetres,
        sunriseLimb: settings.sunrise.limb,
        sunriseRefraction: settings.sunrise.refraction,
        sunriseHour: settings.sunrise.nominalHour,
        dasaYearKind: settings.dasaYear.kind,
        dasaYearDays: settings.dasaYear.days,
        dasamsaScheme: settings.dasamsaScheme,
        horaScheme: settings.horaScheme,
        vargaVariants: settings.vargaVariants,
    };
}

/**
 * Copy a preset or settings object onto a request. Keys already on `body` win.
 * Requests that name neither a preset, nor `settings`, nor `dasaYearDays` are
 * returned unchanged.
 */
export function expandCalculationBody(body: Record<string, unknown>): Record<string, unknown> {
    const preset =
        typeof body.preset === 'string' && isPresetId(body.preset) ? body.preset : undefined;
    const invalidPreset = typeof body.preset === 'string' && !isPresetId(body.preset);
    const hasSettings =
        body.settings !== null &&
        typeof body.settings === 'object' &&
        !Array.isArray(body.settings);
    const hasYear = typeof body.dasaYearDays === 'number';
    if (invalidPreset || (!preset && !hasSettings && !hasYear)) return body;

    let settings = getPreset(preset ?? 'node-jhora-default');
    if (hasSettings) settings = resolveCalculationInput(body.settings as SettingsInput, settings);
    if (hasYear) {
        const days = body.dasaYearDays as number;
        const kind =
            typeof body.dasaYearKind === 'string'
                ? (body.dasaYearKind as DasaYearKind)
                : inferDasaYearKind(days);
        settings = resolveCalculationInput({ dasaYear: { kind, days } }, settings);
    }

    const next: Record<string, unknown> = {
        ...flatFromSettings(settings),
        ...body,
        applyDasaYear: true,
    };
    delete next.settings;
    return next;
}

export function expandRequestBody(body: Record<string, unknown>): Record<string, unknown> {
    if ('person1' in body || 'person2' in body) {
        const next = { ...body };
        if (body.person1 && typeof body.person1 === 'object' && !Array.isArray(body.person1)) {
            next.person1 = expandCalculationBody(body.person1 as Record<string, unknown>);
        }
        if (body.person2 && typeof body.person2 === 'object' && !Array.isArray(body.person2)) {
            next.person2 = expandCalculationBody(body.person2 as Record<string, unknown>);
        }
        return next;
    }
    return expandCalculationBody(body);
}
