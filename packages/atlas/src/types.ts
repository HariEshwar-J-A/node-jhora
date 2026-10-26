/** Compact place record stored in `places.json` (tuple form on disk). */
export type PlaceRecord = readonly [
    /** Display name */
    name: string,
    latitude: number,
    longitude: number,
    /** IANA timezone id */
    timezone: string,
    /** ISO 3166-1 alpha-2 */
    countryCode: string,
    /** Admin1 name (state/province), may be empty */
    admin1: string,
    population: number,
    /** GeoNames id */
    geonameId: number,
];

export interface GazetteerManifest {
    version: number;
    attribution: string;
    license: string;
    geonamesUrl: string;
    builtAt: string;
    placeCount: number;
    keyCount: number;
    places: string;
    /** Intern table for compact index shards (optional in tiny fixtures). */
    strings?: string;
    indexShards: Record<string, string>;
}

export interface PlaceHit {
    geonameId: number;
    name: string;
    latitude: number;
    longitude: number;
    timezone: string;
    countryCode: string;
    admin1: string;
    population: number;
    matchedKey: string;
}

export interface SearchOptions {
    limit?: number;
}

export type IndexShardRaw = {
    keys: string[] | number[];
    placeIndexes: number[];
};

export type IndexShardPayload = {
    keys: string[];
    placeIndexes: number[];
};

export type ShardLoader = (shardId: string) => Promise<IndexShardPayload>;
