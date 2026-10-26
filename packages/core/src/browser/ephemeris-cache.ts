import { setBspBytesLoader } from '../engine/bsp-bytes-provider.js';
import { sha256Hex } from '../settings/sha256.js';
import { DE440S_BYTES, DE440S_SHA256, DE440S_URLS } from './constants.js';

const IDB_NAME = 'node-jhora-ephe';
const IDB_STORE = 'kernels';
const IDB_KEY = 'de440s.bsp';
const CACHE_NAME = 'node-jhora-ephe-v1';

export interface EnsureEphemerisOptions {
    /** First URL tried; defaults to the JPL mirror list in {@link DE440S_URLS}. */
    urls?: readonly string[];
    /** When set, skip network fetch and read only from IndexedDB / Cache API. */
    offlineOnly?: boolean;
}

function assertPinnedKernel(bytes: Uint8Array): void {
    if (bytes.byteLength !== DE440S_BYTES) {
        throw new Error(
            `de440s.bsp size mismatch: expected ${DE440S_BYTES}, got ${bytes.byteLength}`,
        );
    }
    const digest = sha256Hex(bytes);
    if (digest !== DE440S_SHA256) {
        throw new Error(`de440s.bsp SHA-256 mismatch: expected ${DE440S_SHA256}, got ${digest}`);
    }
}

async function readIndexedDb(): Promise<Uint8Array | undefined> {
    if (typeof indexedDB === 'undefined') return undefined;
    return new Promise((resolve, reject) => {
        const open = indexedDB.open(IDB_NAME, 1);
        open.onupgradeneeded = () => {
            open.result.createObjectStore(IDB_STORE);
        };
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction(IDB_STORE, 'readonly');
            const get = tx.objectStore(IDB_STORE).get(IDB_KEY);
            get.onerror = () => reject(get.error);
            get.onsuccess = () => {
                const value = get.result;
                resolve(value instanceof Uint8Array ? value : undefined);
            };
        };
    });
}

async function writeIndexedDb(bytes: Uint8Array): Promise<void> {
    if (typeof indexedDB === 'undefined') return;
    await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(IDB_NAME, 1);
        open.onupgradeneeded = () => {
            open.result.createObjectStore(IDB_STORE);
        };
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction(IDB_STORE, 'readwrite');
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
            tx.objectStore(IDB_STORE).put(bytes, IDB_KEY);
        };
    });
}

async function readCacheStorage(): Promise<Uint8Array | undefined> {
    if (typeof caches === 'undefined') return undefined;
    const cache = await caches.open(CACHE_NAME);
    for (const url of DE440S_URLS) {
        const hit = await cache.match(url);
        if (!hit) continue;
        const buf = await hit.arrayBuffer();
        return new Uint8Array(buf);
    }
    return undefined;
}

async function writeCacheStorage(bytes: Uint8Array, sourceUrl: string): Promise<void> {
    if (typeof caches === 'undefined') return;
    const cache = await caches.open(CACHE_NAME);
    const copy = bytes.slice();
    await cache.put(
        sourceUrl,
        new Response(new Blob([copy]), {
            headers: { 'Content-Type': 'application/octet-stream' },
        }),
    );
}

async function fetchKernel(urls: readonly string[]): Promise<{ bytes: Uint8Array; url: string }> {
    let lastErr: unknown;
    for (const url of urls) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buf = new Uint8Array(await res.arrayBuffer());
            assertPinnedKernel(buf);
            return { bytes: buf, url };
        } catch (err) {
            lastErr = err;
        }
    }
    throw new Error(`Failed to download de440s.bsp: ${String(lastErr)}`);
}

/**
 * Resolve DE440s bytes from IndexedDB, Cache API, or network (in that order),
 * persist successful downloads, and verify the pinned SHA-256.
 */
export async function ensureEphemerisBytes(
    options: EnsureEphemerisOptions = {},
): Promise<Uint8Array> {
    const urls = options.urls ?? DE440S_URLS;

    const fromIdb = await readIndexedDb();
    if (fromIdb) {
        assertPinnedKernel(fromIdb);
        return fromIdb;
    }

    const fromCache = await readCacheStorage();
    if (fromCache) {
        assertPinnedKernel(fromCache);
        await writeIndexedDb(fromCache);
        return fromCache;
    }

    if (options.offlineOnly) {
        throw new Error('de440s.bsp is not cached for offline use');
    }

    const { bytes, url } = await fetchKernel(urls);
    await writeIndexedDb(bytes);
    await writeCacheStorage(bytes, url);
    return bytes;
}

/** Register {@link ensureEphemerisBytes} as the BSP loader used by {@link EphemerisEngine}. */
export function registerBrowserEphemerisProvider(options: EnsureEphemerisOptions = {}): void {
    setBspBytesLoader(async () => ensureEphemerisBytes(options));
}
