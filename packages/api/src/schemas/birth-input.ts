import { z } from 'zod';

export const AYANAMSA_MAP = {
    lahiri:     1,
    raman:      3,
    kp:         5,
    yukteshwar: 7,
    true_pushya: 27,
} as const;

export type AyanamsaKey = keyof typeof AYANAMSA_MAP;

/**
 * Standard birth input used across all chart-based endpoints.
 */
export const BirthInputSchema = z.object({
    date:        z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
    time:        z.string().regex(/^\d{2}:\d{2}:\d{2}$/, 'Must be HH:MM:SS'),
    latitude:    z.number().min(-90).max(90),
    longitude:   z.number().min(-180).max(180),
    timezone:    z.string().min(1),
    ayanamsa:    z.enum(['lahiri', 'raman', 'kp', 'yukteshwar', 'true_pushya']).default('lahiri'),
    nodeType:    z.enum(['mean', 'true']).default('mean'),
    houseSystem: z.enum(['whole_sign', 'placidus', 'porphyry']).default('whole_sign'),
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
export const DashaInputSchema = BirthInputSchema.extend({
    depth: z.number().int().min(1).max(5).default(2),
});

export type DashaInput = z.infer<typeof DashaInputSchema>;
