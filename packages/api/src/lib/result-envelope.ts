import { type SettingsHashValue, withResultEnvelope } from '@node-jhora/core';

export interface ApiEnvelopeOptions {
    settingsHash: SettingsHashValue;
    warnings?: readonly string[];
    /** Set true to stamp `computedAt` with the current instant (non-deterministic). */
    stampComputedAt?: boolean;
}

/** Attach core provenance fields to a route handler payload. */
export function attachResultEnvelope<T extends Record<string, unknown>>(
    payload: T,
    options: ApiEnvelopeOptions,
): T & ReturnType<typeof withResultEnvelope<T>> {
    return withResultEnvelope(payload, {
        settingsHash: options.settingsHash,
        warnings: options.warnings,
        computedAt: options.stampComputedAt ? new Date().toISOString() : undefined,
    });
}
