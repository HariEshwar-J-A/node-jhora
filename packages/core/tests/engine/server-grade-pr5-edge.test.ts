/**
 * Server-grade PR5 gates: edge in-memory NJCE loader, auto DE440s fingerprint,
 * windowed long-range fixtures, DE441 vs DE440s overlap report, kernel Sun hex.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DateTime } from 'luxon';

import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { deltaT } from '../../src/engine/deltat.js';
import { loadSpkFromBytes, resetSpkCache } from '../../src/engine/spk.js';
import {
    createDe441ChunkStoreFromMemory,
    de441ChunkKeysForJdTdb,
    inMemoryChunkLoader,
    njceMapKey,
} from '../../src/engine/provider/edge-bootstrap.js';
import {
    NJCE441_MAX_CENTURY,
    NJCE441_MIN_CENTURY,
} from '../../src/ephemeris-data/manifest.de441.js';
import { DE440S_JD_TDB_END, DE440S_JD_TDB_START } from '../../src/engine/provider/de440s.js';

const repoRoot = join(fileURLToPath(import.meta.url), '../../../../..');
const BENCH_INSTANT = DateTime.fromISO('2000-01-01T12:00:00', { zone: 'Asia/Kolkata' });
const BENCH_LOCATION = { latitude: 13.0827, longitude: 80.2707 };
const BENCH_SUN_SIDEREAL_HEX = '488f2f4bc0bf6c40';

function f64Hex(value: number): string {
    const buf = Buffer.alloc(8);
    buf.writeDoubleLE(value);
    return buf.toString('hex');
}

function loadKernelBytes(): Uint8Array {
    const bsp = join(repoRoot, 'packages/ephe/de440s.bsp');
    return new Uint8Array(readFileSync(bsp));
}

function chunk441Dir(): string | undefined {
    const fromEnv = process.env.NJCE441_DIR;
    if (fromEnv) return fromEnv;
    const dist = join(repoRoot, 'packages/ephe441/dist');
    try {
        readFileSync(join(dist, 'g0-c10.njce'));
        return dist;
    } catch {
        return undefined;
    }
}

/** Load only the listed window `.njce` files into memory (not a full-century BSP). */
function loadNjceWindow(
    dir: string,
    keys: ReturnType<typeof de441ChunkKeysForJdTdb>,
): Map<string, ArrayBuffer> {
    const map = new Map<string, ArrayBuffer>();
    const seen = new Set<string>();
    for (const key of keys) {
        const id = njceMapKey(key.groupId, key.century);
        if (seen.has(id)) continue;
        seen.add(id);
        const path = join(dir, `g${key.groupId}-c${key.century}.njce`);
        const buf = readFileSync(path);
        map.set(id, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    }
    return map;
}

describe('server-grade PR5 edge and long-range provider', () => {
    beforeEach(() => resetSpkCache());

    test('inMemoryChunkLoader exposes synchronous loads for De441ChunkStore', () => {
        const bsp = loadKernelBytes();
        const spk = loadSpkFromBytes(bsp);
        void spk;
        const loader = inMemoryChunkLoader({
            '0:0': new ArrayBuffer(8),
        });
        expect(loader.loadSync?.({ century: 0, groupId: 0 })?.byteLength).toBe(8);
    });

    test('initialize({ kernel }) Sun sidereal hex matches bench fingerprint (Node edge path)', async () => {
        const engine = new EphemerisEngine();
        await engine.initialize({ kernel: loadKernelBytes() });
        const planets = engine.getPlanets(BENCH_INSTANT, BENCH_LOCATION, {
            zodiac: 'sidereal',
            ayanamsaOrder: 27,
        });
        const sun = planets.find((p) => p.name === 'Sun')!;
        expect(f64Hex(sun.longitude)).toBe(BENCH_SUN_SIDEREAL_HEX);
    });

    test('auto policy inside DE440s span matches de440s Sun hex on bench chart', async () => {
        const chunkDir = chunk441Dir();
        if (!chunkDir) {
            console.warn('skip: NJCE441 window chunks not present');
            return;
        }
        const engine = new EphemerisEngine();
        const keys = de441ChunkKeysForJdTdb(2_451_153.661_805_555_7);
        const store = createDe441ChunkStoreFromMemory(loadNjceWindow(chunkDir, keys));
        engine.setDe441ChunkStore(store);
        await engine.initialize({ kernel: loadKernelBytes() });
        engine.setEphemerisPolicy('auto');

        const de440sOnly = new EphemerisEngine();
        await de440sOnly.initialize({ kernel: loadKernelBytes() });
        de440sOnly.setEphemerisPolicy('de440s');

        const opts = { zodiac: 'sidereal' as const, ayanamsaOrder: 27 };
        const autoSun = engine
            .getPlanets(BENCH_INSTANT, BENCH_LOCATION, opts)
            .find((p) => p.name === 'Sun')!;
        const pureSun = de440sOnly
            .getPlanets(BENCH_INSTANT, BENCH_LOCATION, opts)
            .find((p) => p.name === 'Sun')!;

        expect(f64Hex(autoSun.longitude)).toBe(BENCH_SUN_SIDEREAL_HEX);
        expect(f64Hex(pureSun.longitude)).toBe(BENCH_SUN_SIDEREAL_HEX);
        expect(autoSun.longitude).toBe(pureSun.longitude);
    });

    test('reports DE441 vs DE440s sidereal Sun overlap at bench JD (not forced equal)', async () => {
        const chunkDir = chunk441Dir();
        if (!chunkDir) return;

        const jdBench = 2_451_153.661_805_555_7;
        expect(jdBench).toBeGreaterThanOrEqual(DE440S_JD_TDB_START);
        expect(jdBench).toBeLessThanOrEqual(DE440S_JD_TDB_END);

        const engine = new EphemerisEngine();
        engine.setDe441ChunkStore(
            createDe441ChunkStoreFromMemory(
                loadNjceWindow(chunkDir, de441ChunkKeysForJdTdb(jdBench)),
            ),
        );
        await engine.initialize({ kernel: loadKernelBytes() });

        const opts = { zodiac: 'sidereal' as const, ayanamsaOrder: 27 };
        engine.setEphemerisPolicy('de440s');
        const de440sSun = engine
            .getPlanets(BENCH_INSTANT, BENCH_LOCATION, opts)
            .find((p) => p.name === 'Sun')!.longitude;

        engine.setEphemerisPolicy('de441_long');
        const de441Sun = engine
            .getPlanets(BENCH_INSTANT, BENCH_LOCATION, opts)
            .find((p) => p.name === 'Sun')!.longitude;

        const deltaArcsec = Math.abs(de440sSun - de441Sun) * 3600;
        console.log(
            `PR5 overlap report: |DE440s − DE441| Sun sidereal = ${deltaArcsec.toExponential(3)} arcsec at bench JD`,
        );
        expect(Number.isFinite(de440sSun)).toBe(true);
        expect(Number.isFinite(de441Sun)).toBe(true);
        expect(deltaArcsec).toBeLessThan(1);
    });

    describe('windowed NJCE fixtures (finite sidereal longitudes)', () => {
        const chunkDir = chunk441Dir();
        if (!chunkDir) {
            test.skip('NJCE441 dist not available', () => {});
            return;
        }

        async function planetsAtUtcYear(
            year: number,
            month: number,
            day: number,
        ): Promise<{ longitude: number }[]> {
            const engine = new EphemerisEngine();
            await engine.initialize({ kernel: loadKernelBytes() });
            const instant = DateTime.utc(year, month, day, 12, 0, 0);
            const jdUt = engine.julday(instant);
            const jdTdb = jdUt + deltaT(jdUt) / 86_400;
            const keys = de441ChunkKeysForJdTdb(jdTdb);
            const store = createDe441ChunkStoreFromMemory(loadNjceWindow(chunkDir!, keys));
            engine.setDe441ChunkStore(store);
            engine.setEphemerisPolicy('auto');
            return engine.getPlanets(instant, BENCH_LOCATION, {
                zodiac: 'sidereal',
                ayanamsaOrder: 27,
            });
        }

        test('year 1000 returns finite sidereal longitudes', async () => {
            const planets = await planetsAtUtcYear(1000, 6, 15);
            for (const p of planets) {
                expect(Number.isFinite(p.longitude)).toBe(true);
                expect(p.longitude).toBeGreaterThanOrEqual(0);
                expect(p.longitude).toBeLessThan(360);
            }
        });

        test('year −9999 returns finite sidereal longitudes', async () => {
            const planets = await planetsAtUtcYear(-9999, 6, 15);
            for (const p of planets) {
                expect(Number.isFinite(p.longitude)).toBe(true);
            }
            expect(NJCE441_MIN_CENTURY).toBeLessThanOrEqual(-100);
            expect(NJCE441_MAX_CENTURY).toBeGreaterThanOrEqual(10);
        });
    });
});
