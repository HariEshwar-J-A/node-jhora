import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { De441ChunkStore, EphemerisEngine, nodeFsChunkLoader } from '@node-jhora/core';
import { registerNodeBspLoaderFromCore } from '@node-jhora/core/node/register';

import { DEEP_ERA_TRUTH_MEAN_NODE_JD_TT } from './chart-fixture.js';
import { p50, p99 } from './stats.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function preloadNodeFsChunkLoaderModules(): Promise<void> {
    const mod = await import(
        pathToFileURL(join(__dirname, '../../core/dist/engine/provider/chunk-loader.js')).href
    );
    await mod.preloadNodeFsChunkLoaderModules();
}

async function loadEop(engine: EphemerisEngine): Promise<void> {
    const eopPath = join(__dirname, '../../eop/eop.bin');
    const mod = await import(pathToFileURL(join(__dirname, '../../eop/index.mjs')).href);
    const table = mod.parseEopBin(readFileSync(eopPath));
    engine.setIersEopTable(table);
}

function resolveNjce441Dir(): string | undefined {
    const fromEnv = process.env.NJCE441_DIR;
    if (fromEnv && existsSync(fromEnv)) {
        return fromEnv;
    }
    const fallback = join(__dirname, '../../ephe441/dist');
    return existsSync(fallback) ? fallback : undefined;
}

async function main(): Promise<void> {
    const chunkDir = resolveNjce441Dir();
    if (!chunkDir) {
        console.log(JSON.stringify({ ok: false, reason: 'NJCE441 chunks not found' }));
        return;
    }

    const meanNodeMod = await import(
        pathToFileURL(join(__dirname, '../../core/dist/engine/mean-lunar-node.js')).href
    );
    const lunarNodeMod = await import(
        pathToFileURL(join(__dirname, '../../core/dist/engine/de441-mean-lunar-node.js')).href
    );

    await registerNodeBspLoaderFromCore();
    await preloadNodeFsChunkLoaderModules();

    const chunkLoader = await import(
        pathToFileURL(join(__dirname, '../../core/dist/engine/provider/chunk-loader.js')).href
    );

    const engine = EphemerisEngine.getInstance();
    await loadEop(engine);
    const store = new De441ChunkStore(nodeFsChunkLoader(chunkDir));
    engine.setDe441ChunkStore(store);
    await engine.initialize();
    chunkLoader.prefetchNjceForSecularMeanNode(store, DEEP_ERA_TRUTH_MEAN_NODE_JD_TT);

    const jdTT = DEEP_ERA_TRUTH_MEAN_NODE_JD_TT;
    const meanNode = meanNodeMod.meanLunarNodeFromJdTTForProfile as (
        jd: number,
        profile: 'truth',
    ) => number;
    const clearCaches = lunarNodeMod.clearDe441MeanNodeCaches as () => void;

    const coldSamples: number[] = [];
    for (let i = 0; i < 9; i++) {
        clearCaches();
        const t0 = performance.now();
        meanNode(jdTT, 'truth');
        coldSamples.push(performance.now() - t0);
    }

    clearCaches();
    meanNode(jdTT, 'truth');
    const warmSamples: number[] = [];
    for (let i = 0; i < 9; i++) {
        const t0 = performance.now();
        meanNode(jdTT, 'truth');
        warmSamples.push(performance.now() - t0);
    }

    const rssMb = process.memoryUsage().rss / (1024 * 1024);

    console.log(
        JSON.stringify({
            ok: true,
            jdTT,
            cold: {
                p50Ms: p50(coldSamples),
                p99Ms: p99(coldSamples),
                samplesMs: coldSamples,
                rssMb,
            },
            warm: {
                p50Ms: p50(warmSamples),
                p99Ms: p99(warmSamples),
                samplesMs: warmSamples,
                rssMb,
            },
        }),
    );
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
