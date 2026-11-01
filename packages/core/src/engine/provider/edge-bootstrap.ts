// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Edge runtime bootstrap: DE440s bytes via `initialize({ kernel })` and
 * windowed DE441 NJCE chunks via an in-memory loader (no multi-GB century kernels).
 */

import { NJCE441_MAX_CENTURY, NJCE441_MIN_CENTURY } from '../../ephemeris-data/manifest.de441.js';
import {
    type ChunkKey,
    chunkKeysForJdTdb,
    De441ChunkStore,
    inMemoryChunkLoader,
    njceMapKey,
} from './chunk-loader.js';

export { chunkKeysForJdTdb, inMemoryChunkLoader, njceMapKey };

const DE441_BOUNDS = { minCentury: NJCE441_MIN_CENTURY, maxCentury: NJCE441_MAX_CENTURY };

/** Build a {@link De441ChunkStore} backed only by bytes already in memory. */
export function createDe441ChunkStoreFromMemory(
    chunks: ReadonlyMap<string, ArrayBuffer> | Record<string, ArrayBuffer>,
): De441ChunkStore {
    return new De441ChunkStore(inMemoryChunkLoader(chunks));
}

/** Keys to prefetch into memory before a synchronous chart at `jdTdb`. */
export function de441ChunkKeysForJdTdb(jdTdb: number): ChunkKey[] {
    return chunkKeysForJdTdb(jdTdb, DE441_BOUNDS);
}
