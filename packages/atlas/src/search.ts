import { normalizeSearchKey, shardIdForKey } from './normalize.js';
import type {
    GazetteerManifest,
    IndexShardPayload,
    PlaceHit,
    PlaceRecord,
    SearchOptions,
    ShardLoader,
} from './types.js';

function lowerBound(keys: string[], target: string): number {
    let lo = 0;
    let hi = keys.length;
    while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (keys[mid] < target) lo = mid + 1;
        else hi = mid;
    }
    return lo;
}

function expandPlace(row: PlaceRecord, matchedKey: string): PlaceHit {
    return {
        geonameId: row[7],
        name: row[0],
        latitude: row[1],
        longitude: row[2],
        timezone: row[3],
        countryCode: row[4],
        admin1: row[5],
        population: row[6],
        matchedKey,
    };
}

/** Ranking: exact key match first, then larger population, then lower GeoNames id. */
function rankBefore(a: Candidate, b: Candidate, places: PlaceRecord[]): boolean {
    if (a.exact !== b.exact) return a.exact;
    const pa = places[a.placeIndex][6];
    const pb = places[b.placeIndex][6];
    if (pa !== pb) return pa > pb;
    return places[a.placeIndex][7] < places[b.placeIndex][7];
}

interface Candidate {
    placeIndex: number;
    key: string;
    exact: boolean;
}

/**
 * Scan every key in `shard` that starts with `prefix`, keeping the best
 * `limit` places. Every prefix hit is considered (not just the first `limit`
 * in key order), so ranking is by match quality and population.
 */
function collectPrefixHits(
    shard: IndexShardPayload,
    prefix: string,
    places: PlaceRecord[],
    top: Candidate[],
    best: Map<number, Candidate>,
    limit: number,
): void {
    const { keys, placeIndexes } = shard;
    const start = lowerBound(keys, prefix);
    for (let i = start; i < keys.length; i++) {
        const key = keys[i];
        if (!key.startsWith(prefix)) break;
        const placeIndex = placeIndexes[i];
        const exact = key === prefix;
        const prev = best.get(placeIndex);
        if (prev && (prev.exact || !exact)) continue;
        const cand: Candidate = { placeIndex, key, exact };
        best.set(placeIndex, cand);
        if (prev) {
            const at = top.indexOf(prev);
            if (at >= 0) top.splice(at, 1);
        }
        if (top.length >= limit && !rankBefore(cand, top[top.length - 1], places)) continue;
        let pos = top.length;
        while (pos > 0 && rankBefore(cand, top[pos - 1], places)) pos--;
        top.splice(pos, 0, cand);
        if (top.length > limit) top.pop();
    }
}

export class Gazetteer {
    readonly manifest: GazetteerManifest;
    private readonly places: PlaceRecord[];
    private readonly shards: Map<string, IndexShardPayload>;
    private readonly loadShard: ShardLoader;

    private constructor(
        manifest: GazetteerManifest,
        places: PlaceRecord[],
        shards: Map<string, IndexShardPayload>,
        loadShard: ShardLoader,
    ) {
        this.manifest = manifest;
        this.places = places;
        this.shards = shards;
        this.loadShard = loadShard;
    }

    static async open(
        manifest: GazetteerManifest,
        places: PlaceRecord[],
        loadShard: ShardLoader,
        preloadShardIds?: Iterable<string>,
    ): Promise<Gazetteer> {
        const shards = new Map<string, IndexShardPayload>();
        const ids = preloadShardIds ?? Object.keys(manifest.indexShards);
        for (const id of ids) {
            shards.set(id, await loadShard(id));
        }
        return new Gazetteer(manifest, places, shards, loadShard);
    }

    async ensureShard(shardId: string): Promise<IndexShardPayload> {
        let shard = this.shards.get(shardId);
        if (!shard) {
            shard = await this.loadShard(shardId);
            this.shards.set(shardId, shard);
        }
        return shard;
    }

    search(query: string, options: SearchOptions = {}): PlaceHit[] {
        const limit = options.limit ?? 10;
        if (!(limit > 0)) return [];
        const prefix = normalizeSearchKey(query);
        if (prefix.length === 0) return [];

        return this.searchShards(prefix, limit, this.shardIdsForPrefix(prefix));
    }

    /**
     * Shards that can hold keys starting with `prefix`. Latin and digit keys
     * are bucketed by their first two characters, so a one-character prefix
     * spans every bucket for that character.
     */
    private shardIdsForPrefix(prefix: string): string[] {
        const primary = shardIdForKey(prefix);
        if (prefix.length !== 1 || !/^(la|nu)-/.test(primary)) return [primary];
        return Object.keys(this.manifest.indexShards).filter(
            (id) => id === primary || (id.length === primary.length + 1 && id.startsWith(primary)),
        );
    }

    private searchShards(prefix: string, limit: number, shardIds: string[]): PlaceHit[] {
        const top: Candidate[] = [];
        const best = new Map<number, Candidate>();

        for (const shardId of shardIds) {
            if (!this.manifest.indexShards[shardId]) continue;
            const shard = this.shards.get(shardId);
            if (!shard) {
                throw new Error(`Atlas index shard not loaded: ${shardId}`);
            }
            collectPrefixHits(shard, prefix, this.places, top, best, limit);
        }

        return top.map((c) => expandPlace(this.places[c.placeIndex], c.key));
    }

    /**
     * Resolve a single best match: an exact (normalized) name match wins over a
     * longer prefix match; ties go to the larger population.
     */
    resolve(query: string): PlaceHit | null {
        const hits = this.search(query, { limit: 1 });
        return hits[0] ?? null;
    }
}
