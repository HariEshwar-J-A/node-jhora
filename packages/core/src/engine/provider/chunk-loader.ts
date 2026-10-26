/**
 * Browser-first chunk loading with injectable backends (Cache API, IndexedDB,
 * Node filesystem).
 */

import { BODY_GROUP_EMB, BODY_GROUP_PLANETS, centuryIndex, De431ChunkFile } from './de431-chunk.js';
import { jdTdbToAstronomicalYear } from './de431-chunk.js';

export interface ChunkKey {
    century: number;
    groupId: number;
}

export interface EphemerisChunkLoader {
    /** Fetch bytes for a chunk if available. */
    load(key: ChunkKey): Promise<ArrayBuffer | undefined>;
}

export type ChunkUrlBuilder = (key: ChunkKey) => string;

/**
 * In-memory cache over an async loader (works in Node and workers).
 */
export class CachingChunkLoader implements EphemerisChunkLoader {
    private readonly cache = new Map<string, ArrayBuffer>();

    constructor(private readonly inner: EphemerisChunkLoader) {}

    async load(key: ChunkKey): Promise<ArrayBuffer | undefined> {
        const id = `${key.groupId}:${key.century}`;
        const hit = this.cache.get(id);
        if (hit) return hit;
        const buf = await this.inner.load(key);
        if (buf) this.cache.set(id, buf);
        return buf;
    }
}

/** Node filesystem loader (injected path to `dist/` chunk directory). */
export function nodeFsChunkLoader(baseDir: string): EphemerisChunkLoader {
    return {
        async load(key) {
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

export class De431ChunkStore {
    private readonly files = new Map<string, De431ChunkFile>();

    constructor(private readonly loader: EphemerisChunkLoader) {}

    get(century: number, groupId: number): De431ChunkFile | undefined {
        return this.files.get(`${groupId}:${century}`);
    }

    /** Ensure chunks covering `jdTdb` are resident. */
    async ensureForJd(jdTdb: number): Promise<void> {
        const cent = centuryIndex(jdTdbToAstronomicalYear(jdTdb));
        await Promise.all([
            this.ensureOne(cent, BODY_GROUP_PLANETS),
            this.ensureOne(cent, BODY_GROUP_EMB),
        ]);
    }

    private async ensureOne(century: number, groupId: number): Promise<void> {
        const id = `${groupId}:${century}`;
        if (this.files.has(id)) return;
        const buf = await this.loader.load({ century, groupId });
        if (!buf) return;
        this.files.set(id, new De431ChunkFile(buf));
    }

    asGetter(): (century: number, groupId: number) => De431ChunkFile | undefined {
        return (c, g) => this.get(c, g);
    }
}
