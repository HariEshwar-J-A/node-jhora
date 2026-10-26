import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadGazetteerFromDirectory } from '../src/node.js';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const hasFullData = existsSync(join(DATA_DIR, 'manifest.json'));

describe('@node-jhora/atlas full build', () => {
    if (!hasFullData) {
        it.skip('skipped — run pnpm --filter @node-jhora/atlas atlas:build to generate data/', () => {});
        return;
    }

    it('resolves Chennai aliases on the full gazetteer', async () => {
        const gazetteer = await loadGazetteerFromDirectory(DATA_DIR);
        const ids = ['chennai', 'madras', 'चेन्नई'].map((q) => gazetteer.resolve(q)?.geonameId);
        expect(new Set(ids).size).toBe(1);
        expect(ids[0]).toBe(1264527);
    });

    it('keeps p95 search under 5 ms with all shards loaded', async () => {
        const gazetteer = await loadGazetteerFromDirectory(DATA_DIR);
        const samples = 8_000;
        const queries = ['chen', 'mad', 'san', 'lon', 'new', 'par', 'del', 'चेन'];
        const durations: number[] = [];

        for (let i = 0; i < samples; i++) {
            const start = performance.now();
            gazetteer.search(queries[i % queries.length], { limit: 10 });
            durations.push(performance.now() - start);
        }

        durations.sort((a, b) => a - b);
        const p95 = durations[Math.floor(samples * 0.95)];
        expect(p95).toBeLessThan(5);
    });
});
