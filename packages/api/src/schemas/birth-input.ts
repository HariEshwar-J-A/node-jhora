import { z } from 'zod';

export const AYANAMSA_MAP = {
    lahiri:      1,
    raman:       3,
    kp:          5,
    yukteshwar:  7,
    true_pushya: 29,   // SE code 29 (was incorrectly 27)
} as const;

export type AyanamsaKey = keyof typeof AYANAMSA_MAP;

// ---------------------------------------------------------------------------
// Base schema — all non-location fields are always required;
// location is supplied as EITHER city OR (latitude + longitude + timezone).
// ---------------------------------------------------------------------------

const BirthBaseSchema = z.object({
    date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
    time:        z.string().regex(/^\d{2}:\d{2}:\d{2}$/, 'Must be HH:MM:SS'),
    ayanamsa:    z.enum(['lahiri', 'raman', 'kp', 'yukteshwar', 'true_pushya']).default('lahiri'),
    nodeType:    z.enum(['mean', 'true']).default('mean'),
    houseSystem: z.enum(['whole_sign', 'placidus', 'porphyry']).default('whole_sign'),
    // Location — provide city OR all three coordinate fields
    city:        z.string().min(1).optional(),
    latitude:    z.number().min(-90).max(90).optional(),
    longitude:   z.number().min(-180).max(180).optional(),
    timezone:    z.string().min(1).optional(),
});

const locationRefine = (d: z.infer<typeof BirthBaseSchema>) =>
    d.city !== undefined ||
    (d.latitude !== undefined && d.longitude !== undefined && d.timezone !== undefined);

const locationMessage = 'Provide either "city" or all three of "latitude", "longitude", "timezone"';

/**
 * Standard birth input used across all chart-based endpoints.
 * Accepts either {city} or {latitude, longitude, timezone} for location.
 */
export const BirthInputSchema = BirthBaseSchema.refine(locationRefine, { message: locationMessage });

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
export const DashaInputSchema = BirthBaseSchema
    .extend({ depth: z.number().int().min(1).max(5).default(2) })
    .refine(locationRefine, { message: locationMessage });

export type DashaInput = z.infer<typeof DashaInputSchema>;
