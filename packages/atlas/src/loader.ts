import { materializeIndexShard } from './materialize.js';
import { Gazetteer } from './search.js';
import type {
    GazetteerManifest,
    IndexShardPayload,
    IndexShardRaw,
    PlaceRecord,
    ShardLoader,
} from './types.js';

/** Browser/worker shard loader using `fetch` (no Node built-ins). */
export function createFetchShardLoader(
    manifest: GazetteerManifest,
    baseUrl: string | URL,
    strings: string[] | null = null,
): ShardLoader {
    const root = typeof baseUrl === 'string' ? baseUrl : baseUrl.href;
    return async (shardId: string): Promise<IndexShardPayload> => {
        const rel = manifest.indexShards[shardId];
        if (!rel) {
            throw new Error(`Unknown atlas index shard: ${shardId}`);
        }
        const url = new URL(rel, root.endsWith('/') ? root : `${root}/`);
        const res = await fetch(url);
        if (!res.ok) {
            throw new Error(`Failed to load atlas shard ${shardId}: HTTP ${res.status}`);
        }
        const raw = (await res.json()) as IndexShardRaw;
        return materializeIndexShard(raw, strings);
    };
}

export async function openGazetteerFromUrls(
    manifestUrl: string | URL,
    placesUrl: string | URL,
    strings: string[] | null = null,
): Promise<Gazetteer> {
    const manifestRes = await fetch(manifestUrl);
    if (!manifestRes.ok) {
        throw new Error(`Failed to load atlas manifest: HTTP ${manifestRes.status}`);
    }
    const manifest = (await manifestRes.json()) as GazetteerManifest;
    const placesRes = await fetch(placesUrl);
    if (!placesRes.ok) {
        throw new Error(`Failed to load atlas places: HTTP ${placesRes.status}`);
    }
    const places = (await placesRes.json()) as PlaceRecord[];
    const base = new URL('.', typeof manifestUrl === 'string' ? manifestUrl : manifestUrl.href);
    const loadShard = createFetchShardLoader(manifest, base, strings);
    return Gazetteer.open(manifest, places, loadShard);
}
