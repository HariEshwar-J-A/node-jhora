// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Calculation settings: one validated object for every choice that changes
 * a number (ayanamsa, nodes, houses, sunrise, dasa year, varga rules).
 *
 * Display choices are not part of this object. `vargaVariants` is stored and
 * hashed, and is resolved into {@link calculateVarga} options by
 * {@link vargaOptionsFromVariants}. Named schemes also live in
 * `horaScheme` and `dasamsaScheme`.
 */

import { z } from 'zod';

import {
    assertValidAyanamsaMode,
    UnknownAyanamsaModeError,
    UnsupportedAyanamsaModeError,
} from '../engine/ayanamsa.js';
import { HOUSE_ANCHOR_IDS, HOUSE_SYSTEM_IDS } from '../engine/house-registry.js';

export { HOUSE_ANCHOR_IDS, HOUSE_SYSTEM_IDS };

export const SETTINGS_SCHEMA_VERSION = 1 as const;

/** Hex digits kept from SHA-256. 16 digits is 64 bits, enough to tell presets apart. */
export const SETTINGS_HASH_HEX_LENGTH = 16;

/**
 * Civil days `generateVimshottari` uses when the caller does not pass a year
 * length. Kept so existing dasha dates do not move.
 */
export const LEGACY_DASHA_YEAR_DAYS_TEXT = '365.256364';
export const LEGACY_DASHA_YEAR_DAYS: number = Number(LEGACY_DASHA_YEAR_DAYS_TEXT);

export const AYANAMSA_IDS = [
    'true_citra',
    'true_pushya',
    'true_mula',
    'fagan_bradley',
    'lahiri',
    'lahiri_icrc',
    'raman',
    'kp',
    'j2000',
] as const;

export const AYANAMSA_MODE_BY_ID: Record<(typeof AYANAMSA_IDS)[number], number> = {
    fagan_bradley: 0,
    lahiri: 1,
    lahiri_icrc: 46,
    raman: 3,
    kp: 5,
    j2000: 18,
    true_citra: 27,
    true_pushya: 29,
    true_mula: 35,
};

export const SUNRISE_LIMBS = ['disc_centre', 'upper_limb'] as const;
export const DASA_YEAR_KINDS = [
    'mean_tropical',
    'true_tropical',
    'mean_sidereal',
    'true_sidereal',
    'savana',
    'tithi_360',
    'user',
] as const;

export type AyanamsaId = (typeof AYANAMSA_IDS)[number];
export type HouseSystemId = (typeof HOUSE_SYSTEM_IDS)[number];
export type HouseAnchorId = (typeof HOUSE_ANCHOR_IDS)[number];
export type SunriseLimb = (typeof SUNRISE_LIMBS)[number];
export type DasaYearKind = (typeof DASA_YEAR_KINDS)[number];

const finite: z.ZodNumber = z.number().finite();

export type UserAyanamsaSettings = {
    t0Jd: number;
    ayanamsaDeg: number;
    t0IsUt?: boolean;
};

const UserAyanamsaSchema: z.ZodType<UserAyanamsaSettings> = z
    .object({
        t0Jd: finite,
        ayanamsaDeg: finite,
        t0IsUt: z.boolean().optional(),
    })
    .strict() as z.ZodType<UserAyanamsaSettings>;

export type SunriseSettings = {
    limb: (typeof SUNRISE_LIMBS)[number];
    refraction: boolean;
    nominalHour: number;
};

const sunriseSchemaBase: z.ZodType<SunriseSettings> = z
    .object({
        limb: z.enum(SUNRISE_LIMBS),
        refraction: z.boolean(),
        /** Local clock hour used for the weekday until a rise/set solver is wired. */
        nominalHour: finite.min(0).max(24),
    })
    .strict() as z.ZodType<SunriseSettings>;
export const SunriseSchema = sunriseSchemaBase;

export type DasaYearSettings = {
    kind: DasaYearKind;
    days: number;
};

const dasaYearSchemaBase: z.ZodType<DasaYearSettings> = z
    .object({
        kind: z.enum(DASA_YEAR_KINDS),
        /** Civil days actually added for one dasa year. */
        days: finite.positive(),
    })
    .strict() as z.ZodType<DasaYearSettings>;
export const DasaYearSchema = dasaYearSchemaBase;

/**
 * Precision profiles. `'jhora'` (default) reproduces Jagannatha Hora (the
 * Swiss Ephemeris 2.02 conventions it ships with). `'modern'` follows the
 * cited sources Swiss Ephemeris 2.10 documents (SMH2016 ΔT, observed ΔT
 * through 2026, apparent ayanamsa, fully converged Placidus). See
 * docs/precision-profiles.md.
 */
export const PRECISION_PROFILES = ['jhora', 'modern', 'truth'] as const;
export type PrecisionProfileId = (typeof PRECISION_PROFILES)[number];

/** Post-bridge ΔT forecast when `precisionProfile` is `'modern'`. Default: `'published'`. */
export const DELTA_T_FORECASTS = ['published', 'oracle-compat'] as const;
export type DeltaTForecastId = (typeof DELTA_T_FORECASTS)[number];

/**
 * Modern geometric star-ayanamsa annual parallax (True/Pushya/Mula … only).
 * Default `'oracle-compat'` matches main and full-range oracle geometric path.
 */
export const STAR_PARALLAX_MODES = ['oracle-compat', 'continuous'] as const;
export type StarParallaxId = (typeof STAR_PARALLAX_MODES)[number];

export const EPHEMERIS_POLICIES = ['auto', 'de440s', 'de431_long', 'de441_long'] as const;
export type EphemerisPolicyId = (typeof EPHEMERIS_POLICIES)[number];

/** Civil calendar for birth dates; omitted means `'auto'` (JHora / SE). */
export const CALENDAR_MODES = ['auto', 'gregorian', 'julian'] as const;
export type CalendarModeId = (typeof CALENDAR_MODES)[number];

/** Validated calculation settings (see {@link CalculationSettingsSchema}). */
export type CalculationSettings = {
    schemaVersion: typeof SETTINGS_SCHEMA_VERSION;
    precisionProfile: PrecisionProfileId;
    deltaTForecast?: DeltaTForecastId;
    starParallax?: StarParallaxId;
    deltaTOverrideSeconds?: number;
    ephemerisPolicy: EphemerisPolicyId;
    calendar?: CalendarModeId;
    ayanamsa: AyanamsaId;
    ayanamsaOffsetDeg: number;
    customAyanamsaMode?: number;
    ayanamsaFlags?: number;
    userAyanamsa?: UserAyanamsaSettings;
    nodeType: 'mean' | 'true';
    houseSystem: HouseSystemId;
    houseAnchor?: HouseAnchorId;
    cuspsInMiddle: boolean;
    positionMode: 'apparent' | 'geometric';
    topocentric: boolean;
    altitudeMetres: number;
    sunrise: SunriseSettings;
    dasaYear: DasaYearSettings;
    dasamsaScheme: 'parashara' | 'jhora_5_8';
    horaScheme: 'parashara' | 'parivritti';
    vargaVariants: Record<string, string>;
};

function buildCalculationSettingsSchema(): z.ZodType<CalculationSettings> {
    const schema = z
        .object({
            schemaVersion: z.literal(SETTINGS_SCHEMA_VERSION).default(SETTINGS_SCHEMA_VERSION),
            precisionProfile: z.enum(PRECISION_PROFILES).default('jhora'),
            /**
             * Post-bridge ΔT forecast for `precisionProfile: 'modern'`. `'published'` (default)
             * uses UKHO lod integration + SMH2016 eq. 4.1; `'oracle-compat'` keeps the legacy
             * in-house curve that matches pyswisseph 2.10 test extrapolation.
             */
            deltaTForecast: z.enum(DELTA_T_FORECASTS).optional(),
            /**
             * Modern geometric star-ayanamsa parallax. `'oracle-compat'` (default): DE440
             * parallax inside the kernel, barycentric outside (matches pyswisseph 2.10 /
             * full-range oracle). `'continuous'`: VSOP87E + edge blend (ADR 0023).
             */
            starParallax: z.enum(STAR_PARALLAX_MODES).optional(),
            /**
             * Fixed ΔT = TT − UT1 in seconds, replacing the profile's ΔT model for
             * the whole calculation. For dates whose ΔT is known from elsewhere
             * (e.g. a later IERS value, or another program's prediction). Omitted
             * by default, so it does not change existing settings hashes.
             */
            deltaTOverrideSeconds: finite.optional(),
            /**
             * `auto` uses DE440s inside 1849–2150 and DE431 long-range chunks outside.
             * `de440s` / `de431_long` / `de441_long` force a single kernel (long-range requires chunks).
             */
            ephemerisPolicy: z.enum(EPHEMERIS_POLICIES).default('auto'),
            /**
             * Omitted = `'auto'` (Julian before 1582-10-15). Non-default values are
             * hashed; `'auto'` is left out so existing settings hashes stay stable.
             */
            calendar: z.enum(CALENDAR_MODES).optional(),
            ayanamsa: z.enum(AYANAMSA_IDS),
            ayanamsaOffsetDeg: finite,
            /**
             * When set, this numeric mode replaces `ayanamsa`. Used for a mode that
             * has no name in {@link AYANAMSA_IDS}.
             */
            customAyanamsaMode: z.number().finite().int().optional(),
            /** Bitwise OR of sidereal projection flags (see `AYANAMSA_FLAGS`). */
            ayanamsaFlags: z.number().finite().int().nonnegative().optional(),
            /** Required when `customAyanamsaMode` is 255 (USER). */
            userAyanamsa: UserAyanamsaSchema.optional(),
            nodeType: z.enum(['mean', 'true']),
            houseSystem: z.enum(HOUSE_SYSTEM_IDS),
            /** Equal / whole-sign wheels may start at the ascendant, Moon, Sun, or 0° Aries. */
            houseAnchor: z.enum(HOUSE_ANCHOR_IDS).optional(),
            /** When true, equal-house cusps are shifted so the ascendant sits at the middle of house 1. */
            cuspsInMiddle: z.boolean(),
            positionMode: z.enum(['apparent', 'geometric']),
            topocentric: z.boolean(),
            altitudeMetres: finite,
            sunrise: SunriseSchema,
            dasaYear: DasaYearSchema,
            dasamsaScheme: z.enum(['parashara', 'jhora_5_8']),
            horaScheme: z.enum(['parashara', 'parivritti']),
            /** Division → variant id; applied by {@link calculateVarga} via {@link vargaOptionsFromVariants}. */
            vargaVariants: z.record(z.string(), z.string()).default({}),
        })
        .strict()
        .superRefine((data, ctx) => {
            const mode = data.customAyanamsaMode ?? AYANAMSA_MODE_BY_ID[data.ayanamsa];
            try {
                assertValidAyanamsaMode(mode);
            } catch (error) {
                const message =
                    error instanceof UnsupportedAyanamsaModeError ||
                    error instanceof UnknownAyanamsaModeError
                        ? error.message
                        : 'Invalid ayanamsa mode';
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message,
                    path:
                        data.customAyanamsaMode !== undefined
                            ? ['customAyanamsaMode']
                            : ['ayanamsa'],
                });
            }
            if (mode === 255 && data.userAyanamsa === undefined) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'USER ayanamsa (mode 255) requires userAyanamsa { t0Jd, ayanamsaDeg }',
                    path: ['userAyanamsa'],
                });
            }
        });
    return schema as z.ZodType<CalculationSettings>;
}

const calculationSettingsSchemaBase: z.ZodType<CalculationSettings> =
    buildCalculationSettingsSchema();

export const CalculationSettingsSchema =
    calculationSettingsSchemaBase as z.ZodType<CalculationSettings>;

const MODE_TO_ID = new Map<number, AyanamsaId>(
    Object.entries(AYANAMSA_MODE_BY_ID).map(([id, mode]) => [mode, id as AyanamsaId]),
);

export function ayanamsaIdForMode(mode: number): AyanamsaId | undefined {
    return MODE_TO_ID.get(mode);
}

export function inferDasaYearKind(days: number): DasaYearKind {
    if (days === 360) return 'savana';
    if (days === LEGACY_DASHA_YEAR_DAYS) return 'mean_sidereal';
    if (days === 365.24219 || Math.abs(days - 365.242189623) < 1e-12) return 'mean_tropical';
    return 'user';
}
