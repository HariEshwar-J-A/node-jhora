export { ATTRIBUTION_TEXT, GEONAMES_LICENSE } from './attribution.js';
export { createFetchShardLoader, openGazetteerFromUrls } from './loader.js';
export { normalizeSearchKey, shardIdForKey } from './normalize.js';
export { Gazetteer } from './search.js';
export type {
    GazetteerManifest,
    IndexShardPayload,
    IndexShardRaw,
    PlaceHit,
    PlaceRecord,
    SearchOptions,
    ShardLoader,
} from './types.js';
