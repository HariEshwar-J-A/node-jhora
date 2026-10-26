/**
 * Provenance envelope attached to every top-level engine / API result.
 *
 * Omit {@link ResultEnvelopeOptions.computedAt} when serialising deterministic
 * outputs (goldens, regression snapshots). Warnings collect non-fatal notices
 * without changing numeric results.
 */

import { ENGINE_VERSION, TZDB_VERSION } from './generated/build-constants.js';

// TODO(provider): EPHEMERIS_PROVIDER and DELTA_T_MODEL are fixed for now. Once a
// long-range provider lands, take both from the active provider and settings.
/** JPL DE440s kernel served by {@link @node-jhora/ephe}. */
export const EPHEMERIS_PROVIDER = 'jpl-de440s';

/**
 * ΔT model id — matches `packages/core/src/engine/deltat.ts`
 * (Espenak & Meeus polynomials, NASA eclipse catalog family).
 */
export const DELTA_T_MODEL = 'espenak-meeus';

export type SettingsHashValue = string | Record<string, string>;

export interface ResultEnvelope {
    engineVersion: string;
    settingsHash: SettingsHashValue;
    ephemerisProvider: string;
    tzdbVersion: string;
    deltaTModel: string;
    warnings: string[];
    /** Present only when explicitly requested; keeps goldens stable when omitted. */
    computedAt?: string;
}

export interface ResultEnvelopeOptions {
    settingsHash: SettingsHashValue;
    warnings?: readonly string[];
    /** ISO-8601 timestamp; omit for deterministic output. */
    computedAt?: string;
}

/** Build the provenance fields without merging into a payload. */
export function createResultEnvelope(options: ResultEnvelopeOptions): ResultEnvelope {
    const warnings = options.warnings?.length ? [...options.warnings] : [];
    const envelope: ResultEnvelope = {
        engineVersion: ENGINE_VERSION,
        settingsHash: options.settingsHash,
        ephemerisProvider: EPHEMERIS_PROVIDER,
        tzdbVersion: TZDB_VERSION,
        deltaTModel: DELTA_T_MODEL,
        warnings,
    };
    if (options.computedAt !== undefined) {
        envelope.computedAt = options.computedAt;
    }
    return envelope;
}

/**
 * Spread provenance onto an existing result object. Existing fields (including
 * `settingsHash` when already on `payload`) are preserved; envelope metadata is
 * additive.
 */
export interface WithResultEnvelopeOptions {
    settingsHash?: SettingsHashValue;
    warnings?: readonly string[];
    computedAt?: string;
}

export function withResultEnvelope<T extends Record<string, unknown>>(
    payload: T,
    options: WithResultEnvelopeOptions = {},
): T & ResultEnvelope {
    const settingsHash =
        options.settingsHash ??
        (typeof payload.settingsHash === 'string' || isSettingsHashRecord(payload.settingsHash)
            ? payload.settingsHash
            : undefined);

    if (settingsHash === undefined) {
        throw new Error('withResultEnvelope: settingsHash is required when not present on payload');
    }

    return {
        ...payload,
        ...createResultEnvelope({
            settingsHash,
            warnings: options.warnings,
            computedAt: options.computedAt,
        }),
    };
}

function isSettingsHashRecord(value: unknown): value is Record<string, string> {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.values(value as Record<string, unknown>).every((v) => typeof v === 'string');
}
