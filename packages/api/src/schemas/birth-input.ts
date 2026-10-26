import { DASA_YEAR_KINDS, HOUSE_SYSTEM_IDS, PRESET_IDS, SUNRISE_LIMBS } from '@node-jhora/core';
import { z } from 'zod';

/**
 * API ayanamsa names → Swiss Ephemeris SE_SIDM_* mode numbers.
 *
 * The `true_*` models are defined by pinning a named star to an exact sidereal
 * longitude, so they carry no fitted constant and are exact at every date.
 * `lahiri` reproduces JHora's Lahiri, which sits ~4.8′ above the Indian Calendar
 * Reform Committee definition available as `lahiri_icrc`.
 */
export const AYANAMSA_MAP = {
    true_chitra: 27, // True Chitrapaksha — Spica at 180° (Drik Siddhanta)
    true_citra: 27, // same mode; spelling used by calculation settings and presets
    true_pushya: 29, // δ Cancri at 106°
    true_revati: 30, // ζ Piscium at 359°50′
    true_mula: 35, // λ Scorpii at 240°
    lahiri: 1, // as JHora reports it
    lahiri_icrc: 2, // Indian Calendar Reform Committee definition
    raman: 3,
    kp: 5,
    yukteshwar: 7,
    fagan_bradley: 0,
    jn_bhasin: 8,
    j2000: 18,
} as const;

export type AyanamsaKey = keyof typeof AYANAMSA_MAP;

/** Names accepted by the `ayanamsa` field, in the order they are documented. */
export const AYANAMSA_KEYS = Object.keys(AYANAMSA_MAP) as [AyanamsaKey, ...AyanamsaKey[]];

/** Project default: True Chitrapaksha with Drik Siddhanta. */
export const DEFAULT_AYANAMSA_KEY: AyanamsaKey = 'true_chitra';

// ---------------------------------------------------------------------------
// Base schema — all non-location fields are always required;
// location is supplied as EITHER city OR (latitude + longitude + timezone).
// ---------------------------------------------------------------------------

const BirthBaseSchema = z.object({
    /**
     * Civil date in astronomical year numbering (year `0000` = 1 BC, `-0001` = 2 BC).
     * Before 1582-10-15 the proleptic Julian calendar applies; on and after that date,
     * Gregorian — matching Swiss Ephemeris / JHora conventions.
     */
    date: z.string().regex(/^-?\d{1,5}-\d{2}-\d{2}$/, 'Must be astronomical YYYY-MM-DD'),
    time: z.string().regex(/^\d{2}:\d{2}:\d{2}$/, 'Must be HH:MM:SS'),
    /**
     * Civil calendar for `date` (default `auto`: Julian before 1582-10-15,
     * Gregorian from then). Use `gregorian` or `julian` to force a convention.
     */
    calendar: z.enum(['auto', 'gregorian', 'julian']).optional(),
    ayanamsa: z.enum(AYANAMSA_KEYS).default(DEFAULT_AYANAMSA_KEY),
    nodeType: z.enum(['mean', 'true']).default('true'),
    /** Report where a body is ('geometric', JHora's convention) or is seen ('apparent'). */
    positionMode: z.enum(['geometric', 'apparent']).default('geometric'),
    /** Correct for the observer's position on Earth's surface (matters for the Moon). */
    topocentric: z.boolean().default(false),
    /** Observer height above the ellipsoid, metres. Only used when topocentric. */
    altitudeMetres: z.number().min(-500).max(9000).default(0),
    /** Constant added to the ayanamsa, degrees. */
    ayanamsaOffset: z.number().min(-10).max(10).default(0),
    /** D10 rule for even signs. 'parashara' follows BPHS; 'jhora_5_8' reproduces JHora. */
    dasamsaScheme: z.enum(['parashara', 'jhora_5_8']).default('parashara'),
    /** D2 rule. 'parashara' follows BPHS (Leo/Cancer only); 'parivritti' is the 12-sign variant. */
    horaScheme: z.enum(['parashara', 'parivritti']).default('parashara'),
    /** Local sunrise as a decimal hour; the Vedic weekday begins at sunrise. */
    sunriseHour: z.number().min(0).max(24).default(6),
    houseSystem: z.enum(HOUSE_SYSTEM_IDS).default('whole_sign'),
    /**
     * Preset id. Explicit fields on the same body win. Consumed before
     * validation by `expandRequestBody`, which also accepts a `settings` object.
     */
    preset: z.enum(PRESET_IDS).optional(),
    /** Set when a preset, settings object, or `dasaYearDays` was sent. */
    applyDasaYear: z.boolean().optional(),
    dasaYearKind: z.enum(DASA_YEAR_KINDS).optional(),
    dasaYearDays: z.number().positive().optional(),
    cuspsInMiddle: z.boolean().optional(),
    sunriseLimb: z.enum(SUNRISE_LIMBS).optional(),
    sunriseRefraction: z.boolean().optional(),
    vargaVariants: z.record(z.string(), z.string()).optional(),
    customAyanamsaMode: z.number().int().optional(),
    // Location — provide city OR all three coordinate fields
    city: z.string().min(1).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    timezone: z.string().min(1).optional(),
});

const locationRefine = (d: z.infer<typeof BirthBaseSchema>) =>
    d.city !== undefined ||
    (d.latitude !== undefined && d.longitude !== undefined && d.timezone !== undefined);

const locationMessage = 'Provide either "city" or all three of "latitude", "longitude", "timezone"';

/**
 * Standard birth input used across all chart-based endpoints.
 * Accepts either {city} or {latitude, longitude, timezone} for location.
 */
export const BirthInputSchema = BirthBaseSchema.refine(locationRefine, {
    message: locationMessage,
});

export type BirthInput = z.infer<typeof BirthInputSchema>;

/**
 * Compatibility (match) endpoint needs two charts.
 */
export const MatchInputSchema = z.object({
    person1: BirthInputSchema,
    person2: BirthInputSchema,
});

export type MatchInput = z.infer<typeof MatchInputSchema>;

/**
 * Dasha endpoint can optionally set tree depth (1–5).
 */
export const DashaInputSchema = BirthBaseSchema.extend({
    depth: z.number().int().min(1).max(5).default(2),
}).refine(locationRefine, { message: locationMessage });

export type DashaInput = z.infer<typeof DashaInputSchema>;

/**
 * Transit endpoint: the birth fields describe the native, `asOf` is the moment
 * the sky is evaluated for. Defaults to now, which is what an interpretive
 * question almost always means.
 */
export const TransitInputSchema = BirthBaseSchema.extend({
    asOf: z.string().datetime({ offset: true }).optional(),
    horizonDays: z.number().int().min(1).max(3650).default(365),
}).refine(locationRefine, { message: locationMessage });

export type TransitInput = z.infer<typeof TransitInputSchema>;

/**
 * Composite reading: natal chart, the live dasha stack, and current transits in
 * one response. `asOf` is the moment being asked about (default now); the birth
 * fields still describe the native.
 */
export const ReadingInputSchema = BirthBaseSchema.extend({
    asOf: z.string().datetime({ offset: true }).optional(),
    /** Dasha tree depth. 3 reaches Pratyantardasha, which readings need. */
    depth: z.number().int().min(1).max(5).default(3),
    horizonDays: z.number().int().min(1).max(3650).default(365),
}).refine(locationRefine, { message: locationMessage });

export type ReadingInput = z.infer<typeof ReadingInputSchema>;
