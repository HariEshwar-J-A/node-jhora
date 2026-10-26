import type { IndexShardPayload, IndexShardRaw } from './types.js';

export function materializeIndexShard(
    raw: IndexShardRaw,
    strings: string[] | null,
): IndexShardPayload {
    const first = raw.keys[0];
    if (typeof first === 'number') {
        if (!strings) {
            throw new Error('Atlas shard uses string ids but manifest.strings is missing');
        }
        return {
            keys: (raw.keys as number[]).map((id) => strings[id]),
            placeIndexes: raw.placeIndexes,
        };
    }
    return { keys: raw.keys as string[], placeIndexes: raw.placeIndexes };
}
