import type { GazetteerManifest, PlaceHit, PlaceRecord } from '@node-jhora/atlas';
import {
    createFetchShardLoader,
    Gazetteer,
    normalizeSearchKey,
    shardIdForKey,
} from '@node-jhora/atlas';

export type PlaceSearchRequest = {
    id: number;
    manifestUrl: string;
    query: string;
};

export type PlaceSearchResponse = {
    id: number;
    hits: PlaceHit[];
    error?: string;
};

type PlaceWorkerScope = {
    onmessage: ((event: MessageEvent<PlaceSearchRequest>) => void) | null;
    postMessage: (message: PlaceSearchResponse) => void;
};

const scope = self as unknown as PlaceWorkerScope;

let gazetteer: Gazetteer | null = null;
let opening: Promise<Gazetteer> | null = null;

function openGazetteer(manifestUrl: string): Promise<Gazetteer> {
    if (gazetteer) return Promise.resolve(gazetteer);
    if (!opening) {
        opening = (async () => {
            const manifestRes = await fetch(manifestUrl);
            if (!manifestRes.ok) {
                throw new Error(`Place index manifest HTTP ${manifestRes.status}`);
            }
            const manifest = (await manifestRes.json()) as GazetteerManifest;
            const base = new URL('.', manifestUrl);
            let places: PlaceRecord[] = [];
            if (manifest.places) {
                const placesRes = await fetch(new URL(manifest.places, manifestUrl));
                if (!placesRes.ok) {
                    throw new Error(`Place index HTTP ${placesRes.status}`);
                }
                places = (await placesRes.json()) as PlaceRecord[];
            }
            const opened = await Gazetteer.open(
                manifest,
                places,
                createFetchShardLoader(manifest, base),
                [],
            );
            gazetteer = opened;
            return opened;
        })().catch((err: unknown) => {
            opening = null;
            throw err;
        });
    }
    return opening;
}

scope.onmessage = (event: MessageEvent<PlaceSearchRequest>) => {
    const { id, manifestUrl, query } = event.data;
    void (async () => {
        try {
            const index = await openGazetteer(manifestUrl);
            const prefix = normalizeSearchKey(query);
            if (prefix.length < 2) {
                const empty: PlaceSearchResponse = { id, hits: [] };
                scope.postMessage(empty);
                return;
            }
            const shardId = shardIdForKey(prefix);
            if (index.manifest.indexShards[shardId]) {
                await index.ensureShard(shardId);
            }
            const hits = index.search(query, { limit: 8 });
            const response: PlaceSearchResponse = { id, hits };
            scope.postMessage(response);
        } catch (err) {
            const response: PlaceSearchResponse = {
                id,
                hits: [],
                error: err instanceof Error ? err.message : String(err),
            };
            scope.postMessage(response);
        }
    })();
};
