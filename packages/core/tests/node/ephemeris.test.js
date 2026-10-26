/**
 * Node ephemeris resolver (node/ephemeris.mjs): DE440s lookup, the verified
 * NJCE chunk loader, cache writes and offline behaviour. No network: remote
 * fetches go through a stub fetchImpl.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
    centuriesForYears,
    createNodeChunkLoader,
    DE440S_FILE,
    de440sCachePath,
    defaultCacheDir,
    downloadDe440s,
    njceCacheDir,
    resolveDe440sPath,
    writeVerified,
} from '../../node/ephemeris.mjs';
import {
    DE440S_ENTRY,
    NJCE_DATA_VERSION,
    njceChunkEntry,
} from '../../dist/ephemeris-data/index.js';

const sha = (b) => createHash('sha256').update(b).digest('hex');

/** Manifest entry for g0-c19 with fake bytes of the right length and hash. */
function fakeChunk() {
    const key = { century: 19, groupId: 0 };
    const real = njceChunkEntry(key);
    const bytes = Buffer.alloc(real.bytes, 7);
    return { key, real, bytes };
}

const ENV_KEYS = [
    'NODE_JHORA_EPHE_PATH',
    'NODE_JHORA_EPHE_LONG_DIR',
    'NODE_JHORA_OFFLINE',
    'NODE_JHORA_CACHE_DIR',
    'NODE_JHORA_VERIFY',
];
const savedEnv = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
const realNjceDir = process.env.NJCE_DIR;
let tmp;
beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'nj-ephe-'));
    for (const k of ENV_KEYS) delete process.env[k];
});
afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
    for (const k of ENV_KEYS) {
        if (savedEnv[k] === undefined) delete process.env[k];
        else process.env[k] = savedEnv[k];
    }
});

describe('DE440s', () => {
    test('node/ephemeris.mjs pins the same file as the TypeScript manifest', () => {
        expect({
            file: DE440S_FILE.file,
            bytes: DE440S_FILE.bytes,
            sha256: DE440S_FILE.sha256,
        }).toEqual({ ...DE440S_ENTRY });
        expect(DE440S_FILE.urls[0]).toMatch(/^https:\/\/ssd\.jpl\.nasa\.gov\//);
    });

    test('NODE_JHORA_CACHE_DIR overrides the cache root', () => {
        process.env.NODE_JHORA_CACHE_DIR = tmp;
        expect(defaultCacheDir()).toBe(tmp);
        expect(de440sCachePath()).toBe(
            join(tmp, 'de440s', DE440S_FILE.sha256.slice(0, 16), 'de440s.bsp'),
        );
    });

    test('env path wins and is size-checked', async () => {
        const bad = join(tmp, 'short.bsp');
        writeFileSync(bad, 'nope');
        process.env.NODE_JHORA_EPHE_PATH = bad;
        await expect(resolveDe440sPath({ cacheDir: tmp, offline: true })).rejects.toThrow(
            /expected 32726016 bytes/,
        );
    });

    test('downloadDe440s rejects bytes that fail the SHA-256 pin and leaves no file', async () => {
        const fetchImpl = async () => new Response(new Uint8Array(DE440S_FILE.bytes));
        await expect(
            downloadDe440s({
                cacheDir: tmp,
                urls: ['https://mirror.invalid/de440s.bsp'],
                fetchImpl,
            }),
        ).rejects.toThrow(/SHA-256 mismatch/);
        expect(() => readFileSync(de440sCachePath(tmp))).toThrow();
    });
});

describe('NJCE chunk loader', () => {
    test('centuriesForYears clamps to DE431 coverage', () => {
        expect(centuriesForYears(1850, 1999)).toEqual([18, 19]);
        expect(centuriesForYears(-150, -101)).toEqual([-2]);
        expect(centuriesForYears(-20000, -9950)).toEqual([-100]);
        expect(centuriesForYears(9999, 50000)).toEqual([99]);
    });

    test('offline with nothing local is a miss, not an error', async () => {
        const loader = await createNodeChunkLoader({
            cacheDir: tmp,
            offline: true,
            baseUrl: 'https://x.invalid/',
        });
        await expect(loader.load({ century: 19, groupId: 0 })).resolves.toBeUndefined();
    });

    test('no remote configured is a miss', async () => {
        const loader = await createNodeChunkLoader({ cacheDir: tmp });
        await expect(loader.load({ century: 19, groupId: 0 })).resolves.toBeUndefined();
    });

    test('a tampered chunk in a local directory throws', async () => {
        const { key, real } = fakeChunk();
        const dir = join(tmp, 'chunks');
        mkdirSync(dir);
        writeFileSync(join(dir, real.file), Buffer.alloc(real.bytes, 1));
        const loader = await createNodeChunkLoader({ cacheDir: tmp, dirs: [dir], offline: true });
        await expect(loader.load(key)).rejects.toThrow(/does not match the DE431 manifest/);
    });

    test('remote bytes are verified, cached atomically, then served from cache', async () => {
        const { key, real } = fakeChunk();
        const realBytes = readRealChunk(real.file);
        let calls = 0;
        const fetchImpl = async (url) => {
            calls++;
            expect(url).toBe(`https://mirror.example/njce/${real.file}`);
            return new Response(realBytes ?? Buffer.alloc(real.bytes, 3));
        };
        const loader = await createNodeChunkLoader({
            cacheDir: tmp,
            baseUrl: 'https://mirror.example/njce',
            fetchImpl,
        });
        if (!realBytes) {
            // Without real data the stub bytes fail the pin: nothing may be cached.
            await expect(loader.load(key)).rejects.toThrow(/SHA-256 mismatch/);
            expect(() =>
                readFileSync(join(njceCacheDir(tmp, NJCE_DATA_VERSION), real.file)),
            ).toThrow();
            return;
        }
        const buf = await loader.load(key);
        expect(sha(new Uint8Array(buf))).toBe(real.sha256);
        const cached = join(njceCacheDir(tmp, NJCE_DATA_VERSION), real.file);
        expect(sha(readFileSync(cached))).toBe(real.sha256);
        const offline = await createNodeChunkLoader({ cacheDir: tmp, offline: true });
        expect(sha(new Uint8Array(await offline.load(key)))).toBe(real.sha256);
        expect(calls).toBe(1);
    });

    test('a corrupt cache file is discarded and refetched', async () => {
        const { key, real } = fakeChunk();
        const cached = join(njceCacheDir(tmp, NJCE_DATA_VERSION), real.file);
        mkdirSync(join(cached, '..'), { recursive: true });
        writeFileSync(cached, 'corrupt');
        const loader = await createNodeChunkLoader({ cacheDir: tmp, offline: true });
        await expect(loader.load(key)).resolves.toBeUndefined();
        expect(() => readFileSync(cached)).toThrow();
    });

    test('writeVerified never leaves a partial file behind', () => {
        const bytes = Buffer.from('abc');
        const entry = { file: 'abc.bin', bytes: 3, sha256: sha(bytes) };
        const dest = join(tmp, 'nested', 'abc.bin');
        writeVerified(dest, bytes, entry, 'test');
        expect(readFileSync(dest).toString()).toBe('abc');
        expect(() =>
            writeVerified(join(tmp, 'bad.bin'), Buffer.from('abd'), entry, 'test'),
        ).toThrow(/SHA-256/);
        expect(() => readFileSync(join(tmp, 'bad.bin'))).toThrow();
    });
});

function readRealChunk(file) {
    if (!realNjceDir) return undefined;
    const dir = realNjceDir;
    try {
        return readFileSync(join(dir, file));
    } catch {
        return undefined;
    }
}
