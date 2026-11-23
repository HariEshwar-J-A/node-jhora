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

/** Alternate-name hits are used only to fill a short primary list. */
const ALTERNATE_FILL_LIMIT = 8;

interface Candidate {
    place: PlaceRecord;
    key: string;
    /** 0 primary/ascii, 1 word-start, 2 alternate. */
    kind: number;
}

function byPopulation(a: Candidate, b: Candidate): number {
    const pop = b.place[6] - a.place[6];
    if (pop !== 0) return pop;
    return a.place[7] - b.place[7];
}

/** Lower kind first (primary, then word-start), then larger population. */
function byTier(a: Candidate, b: Candidate): number {
    if (a.kind !== b.kind) return a.kind - b.kind;
    return byPopulation(a, b);
}

/**
 * Scan every key in `shard` that starts with `prefix`. A place keeps its best
 * (lowest) kind when several keys match.
 */
function collectPrefixHits(
    shard: IndexShardPayload,
    prefix: string,
    globalPlaces: PlaceRecord[],
    found: Map<number, Candidate>,
): void {
    const places = shard.places ?? globalPlaces;
    const { keys, placeIndexes, kinds } = shard;
    const start = lowerBound(keys, prefix);
    for (let i = start; i < keys.length; i++) {
        const key = keys[i]!;
        if (!key.startsWith(prefix)) break;
        const place = places[placeIndexes[i]!];
        if (!place) continue;
        const kind = kinds?.[i] ?? 0;
        const id = place[7];
        const prev = found.get(id);
        if (prev && prev.kind <= kind) continue;
        found.set(id, { place, key, kind });
    }
}

function rankHits(found: Map<number, Candidate>, limit: number): PlaceHit[] {
    const primary: Candidate[] = [];
    const alternates: Candidate[] = [];
    for (const cand of found.values()) {
        if (cand.kind >= 2) alternates.push(cand);
        else primary.push(cand);
    }
    primary.sort(byTier);
    let ranked = primary;
    if (primary.length < ALTERNATE_FILL_LIMIT) {
        alternates.sort(byPopulation);
        ranked = primary.concat(alternates);
    }
    return ranked.slice(0, limit).map((cand) => expandPlace(cand.place, cand.key));
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
        const found = new Map<number, Candidate>();

        for (const shardId of shardIds) {
            if (!this.manifest.indexShards[shardId]) continue;
            const shard = this.shards.get(shardId);
            if (!shard) {
                throw new Error(`Atlas index shard not loaded: ${shardId}`);
            }
            collectPrefixHits(shard, prefix, this.places, found);
        }

        return rankHits(found, limit);
    }

    /**
     * Resolve a single best match using the same tiers as {@link search}.
     */
    resolve(query: string): PlaceHit | null {
        const hits = this.search(query, { limit: 1 });
        return hits[0] ?? null;
    }
}
