// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Pluggable DE440s kernel loader (browser-safe — no Node built-ins).
 *
 * Node callers register a loader from `packages/core/node/register.mjs`.
 * Browsers pass `kernel` bytes to `EphemerisEngine.initialize({ kernel })`.
 */

export type BspBytesLoader = () => Promise<Uint8Array>;

let loader: BspBytesLoader | undefined;

export function setBspBytesLoader(fn: BspBytesLoader): void {
    loader = fn;
}

export function getBspBytesLoader(): BspBytesLoader | undefined {
    return loader;
}

/** Reset the registered loader (tests). */
export function clearBspBytesLoader(): void {
    loader = undefined;
}
