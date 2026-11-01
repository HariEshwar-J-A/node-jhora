// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

/**
 * Integrity manifest for DE441 long-range NJCE chunks (separate from DE431).
 */

import type { ChunkKey } from '../engine/provider/chunk-loader.js';
import { NJCE441_CHUNK_ROWS } from './manifest.de441.generated.js';

export interface Njce441ChunkEntry {
    readonly file: string;
    readonly bytes: number;
    readonly sha256: string;
    readonly century: number;
    readonly groupId: number;
}

/** JPL DE441 split kernels (NAIF generic_kernels mirror). */
export const DE441_SOURCE = Object.freeze({
    part1: Object.freeze({
        file: 'de441_part-1.bsp',
        bytes: 1_651_119_104,
        url: 'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de441_part-1.bsp',
        jdTdbStart: -3_100_015.5,
        jdTdbEnd: 2_440_432.5,
    }),
    part2: Object.freeze({
        file: 'de441_part-2.bsp',
        bytes: 1_656_830_976,
        url: 'https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de441_part-2.bsp',
        jdTdbStart: 2_440_400.5,
        jdTdbEnd: 8_000_016.5,
    }),
    /** Full-span monolithic kernel on ssd.jpl.nasa.gov (same ephemeris as part-1+2). */
    monolith: Object.freeze({
        file: 'de441.bsp',
        bytes: 3_308_032_000,
        url: 'https://ssd.jpl.nasa.gov/ftp/eph/planets/bsp/de441.bsp',
    }),
});

export const NJCE441_DATA_VERSION = '441.1.0';

export const NJCE441_MIN_CENTURY = -100;
export const NJCE441_MAX_CENTURY = 100;

export const NJCE441_PACKAGE_SPAN_CENTURIES = 5;

export function njce441FileName(key: ChunkKey): string {
    return `g${key.groupId}-c${key.century}.njce`;
}

const chunkIndex441 = new Map<string, Njce441ChunkEntry>();
for (const [century, groupId, bytes, sha256] of NJCE441_CHUNK_ROWS) {
    chunkIndex441.set(
        `${groupId}:${century}`,
        Object.freeze({
            century,
            groupId,
            bytes,
            sha256,
            file: njce441FileName({ century, groupId }),
        }),
    );
}

export function njce441ChunkEntry(key: ChunkKey): Njce441ChunkEntry | undefined {
    return chunkIndex441.get(`${key.groupId}:${key.century}`);
}

export function njce441ChunkEntries(): Njce441ChunkEntry[] {
    return [...chunkIndex441.values()];
}

export function njce441PackageStartYear(century: number): number {
    return (
        Math.floor(century / NJCE441_PACKAGE_SPAN_CENTURIES) * NJCE441_PACKAGE_SPAN_CENTURIES * 100
    );
}

export function njce441PackageName(century: number): string {
    const start = njce441PackageStartYear(century);
    return `@node-jhora/ephe-de441-${start < 0 ? 'm' : 'p'}${Math.abs(start)}`;
}

export function njce441CdnUrl(key: ChunkKey, version: string = NJCE441_DATA_VERSION): string {
    return `https://cdn.jsdelivr.net/npm/${njce441PackageName(key.century)}@${version}/${njce441FileName(key)}`;
}
