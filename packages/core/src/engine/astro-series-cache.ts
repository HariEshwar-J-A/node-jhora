// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Instance-level memo for expensive IAU/Vondrák series keyed by Julian century T (TT)
 * and a series id. Not a module-global Map — bind per {@link EphemerisEngine} via
 * {@link withAstroSeriesCache} during synchronous engine work.
 *
 * @see docs/decisions/0030-astro-series-instance-cache.md (server-grade PR4)
 */

/** Default cap: distinct T values across nutation + Vondrák without thrashing ~40 JD sweeps. */
export const ASTRO_SERIES_CACHE_DEFAULT_CAP = 64;

export const ASTRO_SERIES_NUTATION_IAU2000A = 'nutation-iau2000a';
export const ASTRO_SERIES_VONDRAK_MEAN_OBLIQUITY = 'vondrak-mean-obliquity';
export const ASTRO_SERIES_VONDRAK_PRECESSION_MATRIX = 'vondrak-precession-matrix';

let activeCache: AstroSeriesCache | null = null;

/** Active instance cache for the current synchronous engine call stack. */
export function getActiveAstroSeriesCache(): AstroSeriesCache | null {
    return activeCache;
}

/**
 * Run `fn` with `cache` as the active series memo (nested calls restore the outer cache).
 */
export function withAstroSeriesCache<T>(
    cache: AstroSeriesCache | null | undefined,
    fn: () => T,
): T {
    if (!cache) {
        return fn();
    }
    const previous = activeCache;
    activeCache = cache;
    try {
        return fn();
    } finally {
        activeCache = previous;
    }
}

type CacheEntry = { seriesId: string; T: number };

/**
 * FIFO-evicted memo keyed by `(seriesId, T)` with exact `T` equality (IEEE-754).
 */
export class AstroSeriesCache {
    private readonly stores = new Map<string, Map<number, unknown>>();
    private readonly fifo: CacheEntry[] = [];

    constructor(public readonly maxEntries: number = ASTRO_SERIES_CACHE_DEFAULT_CAP) {}

    get<T>(seriesId: string, T: number, compute: () => T): T {
        let store = this.stores.get(seriesId);
        if (!store) {
            store = new Map();
            this.stores.set(seriesId, store);
        }
        const hit = store.get(T);
        if (hit !== undefined) {
            return hit as T;
        }
        const value = compute();
        store.set(T, value);
        this.fifo.push({ seriesId, T });
        while (this.fifo.length > this.maxEntries) {
            const evict = this.fifo.shift()!;
            const bucket = this.stores.get(evict.seriesId);
            bucket?.delete(evict.T);
        }
        return value;
    }

    clear(): void {
        this.stores.clear();
        this.fifo.length = 0;
    }
}
