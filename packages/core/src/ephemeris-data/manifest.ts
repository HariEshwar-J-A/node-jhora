// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Integrity manifest for the ephemeris data files node-jhora can load.
 *
 * Code packages ship this manifest, never the data. Every loader checks
 * bytes against it before the engine sees them, whatever the source:
 * an installed data package, a cache directory, or a remote URL.
 * See docs/decisions/0006-npm-packaging-and-ephemeris-data-distribution.md.
 */

import type { ChunkKey } from '../engine/provider/chunk-loader.js';
import { NJCE_CHUNK_ROWS } from './manifest.generated.js';

export interface EphemerisFileEntry {
    /** File name inside its data package or cache directory. */
    readonly file: string;
    /** Exact byte length. */
    readonly bytes: number;
    /** Lowercase hex SHA-256 of the file. */
    readonly sha256: string;
}

export interface NjceChunkEntry extends EphemerisFileEntry {
    readonly century: number;
    readonly groupId: number;
}

/** NASA/JPL DE440s (Park et al. 2021, AJ 161 105). NAIF MD5 3917ee56769db332790c751e2168843d. */
export const DE440S_ENTRY: EphemerisFileEntry = Object.freeze({
    file: 'de440s.bsp',
    bytes: 32_726_016,
    sha256: 'c1c7feeab882263fc493a9d5a5b2ddd71b54826cdf65d8d17a76126b260a49f2',
});

/**
 * Primary JPL sources for DE440s. These hosts send no CORS headers, so a
 * browser cannot fetch them; use {@link de440sCdnUrl} or a self-hosted copy there.
 */
export const DE440S_PRIMARY_URLS: readonly string[] = Object.freeze([
    'https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de440s.bsp',
    'https://ssd.jpl.nasa.gov/pub/eph/planets/bsp/de440s.bsp',
]);

/** Source kernel the NJCE chunks were cut from. */
export interface De431SourceManifest {
    readonly file: string;
    readonly bytes: number;
    readonly url: string;
}

export const DE431_SOURCE: De431SourceManifest = Object.freeze({
    file: 'de431t.bsp',
    bytes: 3_696_366_592,
    url: 'https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de431t.bsp',
});

/** NJCE format version + data revision; also the version of the data packages. */
export const NJCE_DATA_VERSION = '431.1.0';

/** Version of `@node-jhora/ephe` whose tarball carries {@link DE440S_ENTRY}. */
export const DE440S_DATA_VERSION = '440.2.0';

export const NJCE_MIN_CENTURY = -100;
export const NJCE_MAX_CENTURY = 100;

/** Centuries per long-range data package (500 years, ~54 MB unpacked). */
export const NJCE_PACKAGE_SPAN_CENTURIES = 5;

export function njceFileName(key: ChunkKey): string {
    return `g${key.groupId}-c${key.century}.njce`;
}

const chunkIndex = new Map<string, NjceChunkEntry>();
for (const [century, groupId, bytes, sha256] of NJCE_CHUNK_ROWS) {
    chunkIndex.set(
        `${groupId}:${century}`,
        Object.freeze({
            century,
            groupId,
            bytes,
            sha256,
            file: njceFileName({ century, groupId }),
        }),
    );
}

/** Manifest entry for one chunk, or undefined outside DE431 coverage. */
export function njceChunkEntry(key: ChunkKey): NjceChunkEntry | undefined {
    return chunkIndex.get(`${key.groupId}:${key.century}`);
}

/** All NJCE chunk entries, ordered by century then group. */
export function njceChunkEntries(): NjceChunkEntry[] {
    return [...chunkIndex.values()];
}

/** First astronomical year covered by the data package holding `century`. */
export function njcePackageStartYear(century: number): number {
    return Math.floor(century / NJCE_PACKAGE_SPAN_CENTURIES) * NJCE_PACKAGE_SPAN_CENTURIES * 100;
}

/**
 * npm name of the long-range data package holding `century`, e.g.
 * `@node-jhora/ephe-de431-p1500` (years 1500..1999) or
 * `@node-jhora/ephe-de431-m3000` (astronomical years -3000..-2501).
 */
export function njcePackageName(century: number): string {
    const start = njcePackageStartYear(century);
    return `@node-jhora/ephe-de431-${start < 0 ? 'm' : 'p'}${Math.abs(start)}`;
}

/** jsDelivr URL for DE440s inside the `@node-jhora/ephe` tarball (CORS-enabled). */
export function de440sCdnUrl(version: string = DE440S_DATA_VERSION): string {
    return `https://cdn.jsdelivr.net/npm/@node-jhora/ephe@${version}/${DE440S_ENTRY.file}`;
}

/** jsDelivr URL for one chunk inside its data package (CORS-enabled). */
export function njceCdnUrl(key: ChunkKey, version: string = NJCE_DATA_VERSION): string {
    return `https://cdn.jsdelivr.net/npm/${njcePackageName(key.century)}@${version}/${njceFileName(key)}`;
}
