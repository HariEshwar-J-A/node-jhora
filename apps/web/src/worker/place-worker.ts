import type {
    GazetteerManifest,
    IndexShardPayload,
    PlaceHit,
    PlaceRecord,
} from '@node-jhora/atlas';
import { Gazetteer, normalizeSearchKey, shardIdForKey } from '@node-jhora/atlas';

export type PlaceWorkerRequest =
    | { type: 'open'; id: number; manifest: GazetteerManifest }
    | { type: 'ingest'; id: number; shardId: string; bytes: ArrayBuffer }
    | { type: 'search'; id: number; query: string };

export type PlaceWorkerResponse = {
    type: 'open' | 'ingest' | 'search';
    id: number;
    shardId?: string;
    hits?: PlaceHit[];
    error?: string;
};

type PlaceWorkerScope = {
    onmessage: ((event: MessageEvent<PlaceWorkerRequest>) => void) | null;
    postMessage: (message: PlaceWorkerResponse) => void;
};

const scope = self as unknown as PlaceWorkerScope;

let gazetteer: Gazetteer | null = null;
const ready = new Map<string, IndexShardPayload>();

const loader = (shardId: string): Promise<IndexShardPayload> => {
    const payload = ready.get(shardId);
    if (!payload) return Promise.reject(new Error(`Place shard ${shardId} is not loaded`));
    return Promise.resolve(payload);
};

async function decodeShard(bytes: ArrayBuffer): Promise<IndexShardPayload> {
    const view = new Uint8Array(bytes);
    let payload = view;
    if (view.byteLength >= 2 && view[0] === 0x1f && view[1] === 0x8b) {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        payload = new Uint8Array(await new Response(stream).arrayBuffer());
    }
    const raw = JSON.parse(new TextDecoder().decode(payload)) as {
        keys: string[] | number[];
        placeIndexes: number[];
        kinds?: number[];
        places?: PlaceRecord[];
    };
    if (typeof raw.keys[0] === 'number') {
        throw new Error('Interned place shards are not loaded in the browser');
    }
    return {
        keys: raw.keys as string[],
        placeIndexes: raw.placeIndexes,
        kinds: raw.kinds,
        places: raw.places,
    };
}

function reply(message: PlaceWorkerResponse): void {
    scope.postMessage(message);
}

scope.onmessage = (event: MessageEvent<PlaceWorkerRequest>) => {
    const message = event.data;
    void (async () => {
        try {
            if (message.type === 'open') {
                gazetteer = await Gazetteer.open(message.manifest, [], loader, []);
                reply({ type: 'open', id: message.id });
                return;
            }
            if (message.type === 'ingest') {
                if (!ready.has(message.shardId)) {
                    ready.set(message.shardId, await decodeShard(message.bytes));
                }
                reply({ type: 'ingest', id: message.id, shardId: message.shardId });
                return;
            }
            if (!gazetteer) throw new Error('Place index is not open');
            const prefix = normalizeSearchKey(message.query);
            if (prefix.length < 2) {
                reply({ type: 'search', id: message.id, hits: [] });
                return;
            }
            const shardId = shardIdForKey(prefix);
            if (gazetteer.manifest.indexShards[shardId]) {
                await gazetteer.ensureShard(shardId);
            }
            const hits = gazetteer.search(message.query, { limit: 8 });
            reply({ type: 'search', id: message.id, hits });
        } catch (err) {
            reply({
                type: message.type === 'search' ? 'search' : message.type,
                id: message.id,
                hits: [],
                error: err instanceof Error ? err.message : String(err),
            });
        }
    })();
};
