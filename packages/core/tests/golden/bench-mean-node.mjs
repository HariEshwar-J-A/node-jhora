#!/usr/bin/env node
/**
 * Isolated DE441 mean-node cold/warm benchmark (Node, NJCE441 chunks in memory).
 */
import {
    preloadNodeFsChunkLoaderModules,
    De441ChunkStore,
    nodeFsChunkLoader,
    prefetchNjceForSecularMeanNode,
} from '../../dist/engine/provider/index.js';
import { createDe441NjceMeanNodeSampler } from '../../dist/engine/de441-njce-mean-node.js';
import {
    benchmarkDe441MeanNode,
    profileDe441MeanNodePrefill,
    setDe441MeanNodeSampler,
} from '../../dist/engine/de441-mean-lunar-node.js';

const chunkDir = process.env.NJCE441_DIR;
if (!chunkDir) {
    console.error('NJCE441_DIR required');
    process.exit(2);
}

const jd = Number(process.env.MEAN_NODE_BENCH_JD ?? -1_931_455);
await preloadNodeFsChunkLoaderModules();
const store = new De441ChunkStore(nodeFsChunkLoader(chunkDir), {
    minCentury: -120,
    maxCentury: 160,
});
prefetchNjceForSecularMeanNode(store, jd);
setDe441MeanNodeSampler(createDe441NjceMeanNodeSampler(store.asGetter()));
const breakdown = profileDe441MeanNodePrefill(jd);
const perf = benchmarkDe441MeanNode(jd);
console.log(
    JSON.stringify({
        ...perf,
        breakdown,
    }),
);
