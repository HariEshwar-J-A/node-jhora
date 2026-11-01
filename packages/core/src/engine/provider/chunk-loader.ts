/**
 * Browser-first chunk loading with injectable backends (Cache API, IndexedDB,
 * Node filesystem).
 */

import { NJCE441_MAX_CENTURY, NJCE441_MIN_CENTURY } from '../../ephemeris-data/manifest.de441.js';
import { NJCE_MAX_CENTURY, NJCE_MIN_CENTURY } from '../../ephemeris-data/manifest.js';
import { CHUNK_PREFETCH_MARGIN_DAYS, PLANET_SPEED_STEP_DAYS } from '../../validation/bounds.js';
import { eraDtdbGeocenterSeconds } from '../dtdb-erfa.js';
import {
    BODY_GROUP_EMB,
    BODY_GROUP_PLANETS,
    centuryIndex,
    De431ChunkFile,
    jdTdbToAstronomicalYear,
} from './de431-chunk.js';

/** Draconic half-width and ±250 yr window (truth mean-node secular definition). */
const MEAN_NODE_HALF_WINDOW_JD = 250 * 365.25;
const MEAN_NODE_DRACONIC_HALF_D = 6798.383 / 2;

export interface ChunkKey {
    century: number;
    groupId: number;
}

export interface EphemerisChunkLoader {
    /** Fetch bytes for a chunk if available. */
    load(key: ChunkKey): Promise<ArrayBuffer | undefined>;
    /** Optional synchronous load (Node filesystem); used for lazy chunk resolution. */
    loadSync?(key: ChunkKey): ArrayBuffer | undefined;
}

export type ChunkUrlBuilder = (key: ChunkKey) => string;

/**
 * In-memory cache over an async loader (works in Node and workers).
 */
function chunkCacheId(key: ChunkKey): string {
    return `${key.groupId}:${key.century}`;
}

export class CachingChunkLoader implements EphemerisChunkLoader {
    private readonly cache = new Map<string, ArrayBuffer>();

    constructor(private readonly inner: EphemerisChunkLoader) {}

    async load(key: ChunkKey): Promise<ArrayBuffer | undefined> {
        const id = chunkCacheId(key);
        const hit = this.cache.get(id);
        if (hit) return hit;
        const buf = await this.inner.load(key);
        if (buf) this.cache.set(id, buf);
        return buf;
    }

    loadSync(key: ChunkKey): ArrayBuffer | undefined {
        const id = chunkCacheId(key);
        const hit = this.cache.get(id);
        if (hit) return hit;
        const buf = this.inner.loadSync?.(key);
        if (buf) this.cache.set(id, buf);
        return buf;
    }
}

/**
 * Synchronous loader over bytes the caller already holds (embed, fetch, R2, KV).
 * Keys use {@link chunkCacheId} (`groupId:century`).
 */
export function inMemoryChunkLoader(
    chunks: ReadonlyMap<string, ArrayBuffer> | Record<string, ArrayBuffer>,
): EphemerisChunkLoader {
    const map = chunks instanceof Map ? chunks : new Map(Object.entries(chunks));
    return {
        loadSync(key) {
            return map.get(chunkCacheId(key));
        },
        async load(key) {
            return map.get(chunkCacheId(key));
        },
    };
}

/** NJCE filenames use `g{group}-c{century}.njce`; map keys use `groupId:century`. */
export function njceMapKey(groupId: number, century: number): string {
    return chunkCacheId({ groupId, century });
}

/**
 * Julian-century NJCE keys needed for synchronous `getPlanets` at `jdTdb`
 * (includes ±1 century neighbours and motion margin).
 */
export function chunkKeysForJdTdb(
    jdTdb: number,
    bounds: { minCentury: number; maxCentury: number },
    marginDays = CHUNK_PREFETCH_MARGIN_DAYS + PLANET_SPEED_STEP_DAYS,
): ChunkKey[] {
    const lo = jdTdb - marginDays;
    const hi = jdTdb + marginDays;
    const centuries = new Set<number>();
    for (const jd of [lo, jdTdb, hi]) {
        centuries.add(centuryIndex(jdTdbToAstronomicalYear(jd)));
    }
    const keys: ChunkKey[] = [];
    for (const cent of centuries) {
        for (const c of [cent - 1, cent, cent + 1]) {
            if (c < bounds.minCentury || c > bounds.maxCentury) continue;
            keys.push({ century: c, groupId: BODY_GROUP_PLANETS });
            keys.push({ century: c, groupId: BODY_GROUP_EMB });
        }
    }
    return keys;
}

let syncFs: typeof import('fs') | undefined;
let syncPath: typeof import('path') | undefined;
const syncModulesReady = (async () => {
    syncFs = await import('fs');
    syncPath = await import('path');
})();

/** Await before synchronous NJCE prefetch in Node (dynamic `fs` import). */
export async function preloadNodeFsChunkLoaderModules(): Promise<void> {
    await syncModulesReady;
}

/** Node filesystem loader (injected path to `dist/` chunk directory). */
export function nodeFsChunkLoader(baseDir: string): EphemerisChunkLoader {
    const loadSyncFn = (key: ChunkKey): ArrayBuffer | undefined => {
        if (!syncFs || !syncPath) return undefined;
        const name = `g${key.groupId}-c${key.century}.njce`;
        const path = syncPath.join(baseDir, name);
        if (!syncFs.existsSync(path)) return undefined;
        const buf = syncFs.readFileSync(path);
        return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    };
    return {
        async load(key) {
            await syncModulesReady;
            const { readFile } = await import('fs/promises');
            const { join } = await import('path');
            const name = `g${key.groupId}-c${key.century}.njce`;
            try {
                const buf = await readFile(join(baseDir, name));
                return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
            } catch {
                return undefined;
            }
        },
        loadSync: loadSyncFn,
    };
}

/** HTTP fetch loader — browser default. */
export function fetchChunkLoader(baseUrl: string): EphemerisChunkLoader {
    const normalized = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    return {
        async load(key) {
            const name = `g${key.groupId}-c${key.century}.njce`;
            const res = await fetch(`${normalized}${name}`);
            if (!res.ok) return undefined;
            return res.arrayBuffer();
        },
    };
}

interface ChunkStoreSync {
    readonly loader: EphemerisChunkLoader;
    readonly minCentury: number;
    readonly maxCentury: number;
    readonly files: Map<string, De431ChunkFile>;
}

function ensureOneSyncOnStore(store: ChunkStoreSync, century: number, groupId: number): void {
    const id = `${groupId}:${century}`;
    if (store.files.has(id)) return;
    const buf = store.loader.loadSync?.({ century, groupId });
    if (!buf) return;
    store.files.set(id, new De431ChunkFile(buf));
}

/**
 * Load every NJCE century bracketing the ±250 yr secular mean-node window at `jdTT`
 * (not exported from `@node-jhora/core` package entry).
 */
export function prefetchNjceForSecularMeanNode(store: De431ChunkStore, jdTT: number): void {
    const internal = store as unknown as ChunkStoreSync;
    if (!internal.loader.loadSync) return;
    const jdMin = jdTT - MEAN_NODE_HALF_WINDOW_JD - MEAN_NODE_DRACONIC_HALF_D;
    const jdMax = jdTT + MEAN_NODE_HALF_WINDOW_JD + MEAN_NODE_DRACONIC_HALF_D;
    const jdTdbLo = jdMin + eraDtdbGeocenterSeconds(jdMin) / 86400;
    const jdTdbHi = jdMax + eraDtdbGeocenterSeconds(jdMax) / 86400;
    const centLo = centuryIndex(jdTdbToAstronomicalYear(jdTdbLo));
    const centHi = centuryIndex(jdTdbToAstronomicalYear(jdTdbHi));
    for (let c = centLo - 1; c <= centHi + 1; c++) {
        if (c < internal.minCentury || c > internal.maxCentury) continue;
        ensureOneSyncOnStore(internal, c, BODY_GROUP_EMB);
        ensureOneSyncOnStore(internal, c, BODY_GROUP_PLANETS);
    }
}

export class De431ChunkStore {
    private readonly files = new Map<string, De431ChunkFile>();
    private readonly minCentury: number;
    private readonly maxCentury: number;

    constructor(
        private readonly loader: EphemerisChunkLoader,
        bounds: { minCentury?: number; maxCentury?: number } = {},
    ) {
        this.minCentury = bounds.minCentury ?? NJCE_MIN_CENTURY;
        this.maxCentury = bounds.maxCentury ?? NJCE_MAX_CENTURY;
    }

    get(century: number, groupId: number): De431ChunkFile | undefined {
        return this.files.get(`${groupId}:${century}`);
    }

    /**
     * Inject pre-fetched `.njce` bytes (edge embed / KV) without reading the filesystem.
     */
    seedChunk(century: number, groupId: number, bytes: ArrayBuffer): void {
        this.files.set(`${groupId}:${century}`, new De431ChunkFile(bytes));
    }

    /**
     * Ensure chunks covering `jdTdb` (and a margin for ΔT and speed differencing)
     * are resident.
     */
    async ensureForJd(jdTdb: number, marginDays = CHUNK_PREFETCH_MARGIN_DAYS): Promise<void> {
        const lo = jdTdb - marginDays - PLANET_SPEED_STEP_DAYS;
        const hi = jdTdb + marginDays + PLANET_SPEED_STEP_DAYS;
        const centuries = new Set<number>();
        for (const jd of [lo, jdTdb, hi]) {
            centuries.add(centuryIndex(jdTdbToAstronomicalYear(jd)));
        }
        for (const cent of centuries) {
            if (cent < this.minCentury || cent > this.maxCentury) continue;
            await Promise.all([
                this.ensureOne(cent, BODY_GROUP_PLANETS),
                this.ensureOne(cent, BODY_GROUP_EMB),
            ]);
            if (cent > this.minCentury) {
                await Promise.all([
                    this.ensureOne(cent - 1, BODY_GROUP_PLANETS),
                    this.ensureOne(cent - 1, BODY_GROUP_EMB),
                ]);
            }
            if (cent < this.maxCentury) {
                await Promise.all([
                    this.ensureOne(cent + 1, BODY_GROUP_PLANETS),
                    this.ensureOne(cent + 1, BODY_GROUP_EMB),
                ]);
            }
        }
    }

    private ensureOneSync(century: number, groupId: number): void {
        const id = `${groupId}:${century}`;
        if (this.files.has(id)) return;
        const buf = this.loader.loadSync?.({ century, groupId });
        if (!buf) return;
        this.files.set(id, new De431ChunkFile(buf));
    }

    private prefetchSyncAroundJd(jdTdb: number): void {
        if (!this.loader.loadSync) return;
        const margin = CHUNK_PREFETCH_MARGIN_DAYS + PLANET_SPEED_STEP_DAYS;
        const lo = jdTdb - margin;
        const hi = jdTdb + margin;
        const centuries = new Set<number>();
        for (const jd of [lo, jdTdb, hi]) {
            centuries.add(centuryIndex(jdTdbToAstronomicalYear(jd)));
        }
        for (const cent of centuries) {
            for (const c of [cent - 1, cent, cent + 1]) {
                if (c < this.minCentury || c > this.maxCentury) continue;
                this.ensureOneSync(c, BODY_GROUP_PLANETS);
                this.ensureOneSync(c, BODY_GROUP_EMB);
            }
        }
    }

    private async ensureOne(century: number, groupId: number): Promise<void> {
        const id = `${groupId}:${century}`;
        if (this.files.has(id)) return;
        const buf = await this.loader.load({ century, groupId });
        if (!buf) return;
        this.files.set(id, new De431ChunkFile(buf));
    }

    asGetter(): (century: number, groupId: number) => De431ChunkFile | undefined {
        return (c, g) => {
            this.ensureOneSync(c, g);
            if (c > this.minCentury) this.ensureOneSync(c - 1, g);
            if (c < this.maxCentury) this.ensureOneSync(c + 1, g);
            return this.get(c, g);
        };
    }

    /** Synchronous prefetch for a UT Julian day (applies ΔT margin in the engine). */
    prefetchSyncForJdTdb(jdTdb: number): void {
        this.prefetchSyncAroundJd(jdTdb);
    }
}

/** DE441 long-range chunks (same `.njce` layout; separate install directory). */
export class De441ChunkStore extends De431ChunkStore {
    constructor(loader: EphemerisChunkLoader) {
        super(loader, { minCentury: NJCE441_MIN_CENTURY, maxCentury: NJCE441_MAX_CENTURY });
    }
}
