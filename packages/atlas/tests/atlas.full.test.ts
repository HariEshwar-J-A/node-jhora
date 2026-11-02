import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadGazetteerFromDirectory } from '../src/node.js';
import { normalizeSearchKey } from '../src/index.js';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
const hasFullData = existsSync(join(DATA_DIR, 'manifest.json'));

describe('@node-jhora/atlas full build', () => {
    if (!hasFullData) {
        it.skip('skipped — run pnpm --filter @node-jhora/atlas atlas:build to generate data/', () => {});
        return;
    }

    it('resolves Chennai by its name and Indic alias, and keeps Bombay on Mumbai', async () => {
        const gazetteer = await loadGazetteerFromDirectory(DATA_DIR);
        expect(gazetteer.resolve('chennai')?.geonameId).toBe(1264527);
        expect(gazetteer.resolve('चेन्नई')?.geonameId).toBe(1264527);
        // No primary name is Bombay, so the historic alternate still selects Mumbai.
        expect(gazetteer.resolve('bombay')?.geonameId).toBe(1275339);
        // A town whose own name is Madras outranks Chennai's historic alias.
        expect(gazetteer.resolve('madras')?.name).toBe('Madras');
        expect(gazetteer.resolve('madras')?.geonameId).not.toBe(1264527);
    }, 120_000);

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
    }, 120_000);

    it('returns only Chen* and São Paulo* names for those queries', async () => {
        const gazetteer = await loadGazetteerFromDirectory(DATA_DIR);
        const chen = gazetteer.search('chen', { limit: 8 });
        expect(chen.length).toBeGreaterThan(0);
        expect(chen.every((hit) => normalizeSearchKey(hit.name).startsWith('chen'))).toBe(true);
        expect(chen.map((hit) => hit.name)).not.toContain('Zhengzhou');
        expect(chen.map((hit) => hit.name)).toContain('Chennai');

        const sao = gazetteer.search('sao paulo', { limit: 8 });
        expect(sao[0]?.name).toBe('São Paulo');
        expect(sao[0]?.timezone).toBe('America/Sao_Paulo');
        expect(sao.every((hit) => normalizeSearchKey(hit.name).startsWith('sao paulo'))).toBe(true);
        for (const noise of ['Frei Paulo', 'Luanda', 'Diamante', 'Caatiba']) {
            expect(sao.map((hit) => hit.name)).not.toContain(noise);
        }
    }, 120_000);

    it('keeps the exhaustive cities1000 index within GitHub Pages limits', () => {
        const manifest = JSON.parse(readFileSync(join(DATA_DIR, 'manifest.json'), 'utf8')) as {
            placeCount: number;
            places?: string;
            shardBytes?: Record<string, number>;
            indexShards: Record<string, string>;
        };
        expect(manifest.placeCount).toBeGreaterThan(100_000);
        expect(manifest.places).toBeUndefined();
        expect(existsSync(join(DATA_DIR, 'places.json'))).toBe(false);
        expect(manifest.shardBytes).toBeTruthy();
        const fileLimit = 100 * 1024 * 1024;
        const atlasLimit = 900 * 1024 * 1024;
        const walk = (dir: string): number => {
            let total = 0;
            for (const name of readdirSync(dir)) {
                const path = join(dir, name);
                const st = statSync(path);
                if (st.isDirectory()) total += walk(path);
                else {
                    expect(st.size).toBeLessThanOrEqual(fileLimit);
                    total += st.size;
                }
            }
            return total;
        };
        expect(walk(DATA_DIR)).toBeLessThanOrEqual(atlasLimit);
        for (const [id, rel] of Object.entries(manifest.indexShards)) {
            expect(manifest.shardBytes?.[id]).toBe(statSync(join(DATA_DIR, rel)).size);
        }
    });
});
