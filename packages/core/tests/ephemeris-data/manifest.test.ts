import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { sha256Hex } from '../../src/settings/sha256.js';
import {
    DE440S_ENTRY,
    de440sCdnUrl,
    EphemerisIntegrityError,
    firstAvailableChunkLoader,
    NJCE_DATA_VERSION,
    NJCE_MAX_CENTURY,
    NJCE_MIN_CENTURY,
    njceCdnUrl,
    njceChunkEntries,
    njceChunkEntry,
    njceFileName,
    njcePackageName,
    njcePackageStartYear,
    sha256HexAsync,
    verifyEphemerisBytes,
    verifyingChunkLoader,
} from '../../src/ephemeris-data/index.js';
import type { EphemerisChunkLoader } from '../../src/engine/provider/index.js';

const HEX64 = /^[0-9a-f]{64}$/;

describe('ephemeris data manifest', () => {
    test('covers every century and body group exactly once', () => {
        const entries = njceChunkEntries();
        expect(entries).toHaveLength((NJCE_MAX_CENTURY - NJCE_MIN_CENTURY + 1) * 2);
        const seen = new Set(entries.map((e) => `${e.groupId}:${e.century}`));
        expect(seen.size).toBe(entries.length);
        for (let c = NJCE_MIN_CENTURY; c <= NJCE_MAX_CENTURY; c++) {
            for (const g of [0, 1]) expect(seen.has(`${g}:${c}`)).toBe(true);
        }
        for (const e of entries) {
            expect(e.sha256).toMatch(HEX64);
            expect(e.bytes).toBeGreaterThan(4_000_000);
            expect(e.file).toBe(njceFileName(e));
        }
        expect(new Set(entries.map((e) => e.sha256)).size).toBe(entries.length);
    });

    test('pins DE440s to the bytes NAIF publishes', () => {
        expect(DE440S_ENTRY).toEqual({
            file: 'de440s.bsp',
            bytes: 32_726_016,
            sha256: 'c1c7feeab882263fc493a9d5a5b2ddd71b54826cdf65d8d17a76126b260a49f2',
        });
    });

    test('names chunk files and 500-year data packages', () => {
        expect(njceFileName({ century: 19, groupId: 0 })).toBe('g0-c19.njce');
        expect(njceFileName({ century: -30, groupId: 1 })).toBe('g1-c-30.njce');
        expect(njcePackageStartYear(19)).toBe(1500);
        expect(njcePackageStartYear(15)).toBe(1500);
        expect(njcePackageStartYear(-1)).toBe(-500);
        expect(njcePackageStartYear(-100)).toBe(-10000);
        expect(njcePackageName(19)).toBe('@node-jhora/ephe-de431-p1500');
        expect(njcePackageName(-30)).toBe('@node-jhora/ephe-de431-m3000');
        expect(njcePackageName(0)).toBe('@node-jhora/ephe-de431-p0');
        const names = new Set(njceChunkEntries().map((e) => njcePackageName(e.century)));
        expect(names.size).toBe(41);
        expect(njceChunkEntry({ century: 100, groupId: 0 })).toBeDefined();
        expect(njceChunkEntry({ century: 0, groupId: 2 })).toBeUndefined();
    });

    test('builds CDN URLs from package names and data versions', () => {
        expect(de440sCdnUrl()).toMatch(
            /^https:\/\/cdn\.jsdelivr\.net\/npm\/@node-jhora\/ephe@440\.2\.0\/de440s\.bsp$/,
        );
        expect(njceCdnUrl({ century: 19, groupId: 1 })).toBe(
            `https://cdn.jsdelivr.net/npm/@node-jhora/ephe-de431-p1500@${NJCE_DATA_VERSION}/g1-c19.njce`,
        );
    });
});

describe('integrity checks', () => {
    const bytes = new TextEncoder().encode('node-jhora');
    const entry = {
        file: 'x.bin',
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
    };

    test('sha256HexAsync matches node:crypto and the sync fallback', async () => {
        expect(await sha256HexAsync(bytes)).toBe(entry.sha256);
        expect(sha256Hex(bytes)).toBe(entry.sha256);
    });

    test('verifyEphemerisBytes accepts a match and rejects size or hash drift', async () => {
        await expect(verifyEphemerisBytes(entry, bytes)).resolves.toBeUndefined();
        await expect(verifyEphemerisBytes(entry, bytes.subarray(1))).rejects.toThrow(
            EphemerisIntegrityError,
        );
        const flipped = bytes.slice();
        flipped[0] ^= 1;
        await expect(verifyEphemerisBytes(entry, flipped, 'test')).rejects.toThrow(/SHA-256/);
    });

    test('verifyingChunkLoader passes misses through and rejects tampered chunks', async () => {
        const key = { century: 19, groupId: 0 };
        const good: EphemerisChunkLoader = { load: async () => bytes.slice().buffer };
        const loader = verifyingChunkLoader(good, {
            entryFor: () => ({ ...entry, century: 19, groupId: 0 }),
        });
        expect(new Uint8Array((await loader.load(key))!)).toEqual(bytes);

        const miss = verifyingChunkLoader({ load: async () => undefined });
        await expect(miss.load(key)).resolves.toBeUndefined();

        const tampered = verifyingChunkLoader(good);
        await expect(tampered.load(key)).rejects.toThrow(EphemerisIntegrityError);
        await expect(tampered.load({ century: 500, groupId: 0 })).rejects.toThrow(/manifest/);
    });

    test('firstAvailableChunkLoader returns the first hit', async () => {
        const calls: string[] = [];
        const make = (name: string, hit: boolean): EphemerisChunkLoader => ({
            load: async () => {
                calls.push(name);
                return hit ? new ArrayBuffer(1) : undefined;
            },
        });
        const loader = firstAvailableChunkLoader([
            make('a', false),
            make('b', true),
            make('c', true),
        ]);
        expect(await loader.load({ century: 0, groupId: 0 })).toBeInstanceOf(ArrayBuffer);
        expect(calls).toEqual(['a', 'b']);
    });
});

const njceDir = process.env.NJCE_DIR;
const realChunks = njceDir && existsSync(join(njceDir, 'g0-c19.njce')) ? test : test.skip;
realChunks('real NJCE chunks match the manifest (NJCE_DIR)', () => {
    for (const e of njceChunkEntries()) {
        const path = join(njceDir!, e.file);
        if (!existsSync(path)) continue;
        expect(createHash('sha256').update(readFileSync(path)).digest('hex')).toBe(e.sha256);
    }
});
