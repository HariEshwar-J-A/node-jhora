import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ATTRIBUTION_TEXT } from './attribution.js';
import { materializeIndexShard } from './materialize.js';
import { Gazetteer } from './search.js';
import type {
    GazetteerManifest,
    IndexShardPayload,
    IndexShardRaw,
    PlaceRecord,
    ShardLoader,
} from './types.js';

/** Data directory as a filesystem path or a `file:` URL. */
export type DataDir = string | URL;

function toPath(dataDir: DataDir): string {
    return typeof dataDir === 'string' ? dataDir : fileURLToPath(dataDir);
}

export async function readGazetteerManifest(dataDir: DataDir): Promise<GazetteerManifest> {
    const raw = await readFile(join(toPath(dataDir), 'manifest.json'), 'utf8');
    const manifest = JSON.parse(raw) as GazetteerManifest;
    if (!manifest.attribution) {
        manifest.attribution = ATTRIBUTION_TEXT;
    }
    return manifest;
}

export async function readPlaces(
    dataDir: DataDir,
    manifest: GazetteerManifest,
): Promise<PlaceRecord[]> {
    const raw = await readFile(join(toPath(dataDir), manifest.places), 'utf8');
    return JSON.parse(raw) as PlaceRecord[];
}

export async function readStringTable(
    dataDir: DataDir,
    manifest: GazetteerManifest,
): Promise<string[] | null> {
    if (!manifest.strings) return null;
    const raw = await readFile(join(toPath(dataDir), manifest.strings), 'utf8');
    return JSON.parse(raw) as string[];
}

export function createDirectoryShardLoader(
    dataDir: DataDir,
    manifest: GazetteerManifest,
    strings: string[] | null,
): ShardLoader {
    return async (shardId: string): Promise<IndexShardPayload> => {
        const rel = manifest.indexShards[shardId];
        if (!rel) {
            throw new Error(`Unknown atlas index shard: ${shardId}`);
        }
        const raw = JSON.parse(await readFile(join(toPath(dataDir), rel), 'utf8')) as IndexShardRaw;
        return materializeIndexShard(raw, strings);
    };
}

export async function loadGazetteerFromDirectory(dataDir: DataDir): Promise<Gazetteer> {
    const manifest = await readGazetteerManifest(dataDir);
    const places = await readPlaces(dataDir, manifest);
    const strings = await readStringTable(dataDir, manifest);
    const loadShard = createDirectoryShardLoader(dataDir, manifest, strings);
    return Gazetteer.open(manifest, places, loadShard, Object.keys(manifest.indexShards));
}
