import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ATTRIBUTION_TEXT, Gazetteer, normalizeSearchKey } from '../src/index.js';
import type { GazetteerManifest, IndexShardPayload, PlaceRecord } from '../src/index.js';
import { loadGazetteerFromDirectory } from '../src/node.js';

const FIXTURE_DIR = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'gazetteer-mini');

describe('@node-jhora/atlas', () => {
    let gazetteer: Gazetteer;

    beforeAll(async () => {
        gazetteer = await loadGazetteerFromDirectory(FIXTURE_DIR);
    }, 60_000);

    it('includes GeoNames CC-BY attribution in the manifest and package export', () => {
        expect(gazetteer.manifest.attribution).toContain('GeoNames');
        expect(gazetteer.manifest.attribution).toContain('CC-BY');
        expect(ATTRIBUTION_TEXT).toContain('GeoNames');
    });

    it('resolves chennai, madras, and Devanagari चेन्नई to the same place', () => {
        const queries = ['chennai', 'madras', 'चेन्नई'];
        const hits = queries.map((q) => gazetteer.resolve(q));
        expect(hits.every((h) => h !== null)).toBe(true);
        const ids = new Set(hits.map((h) => h!.geonameId));
        expect(ids.size).toBe(1);
        expect(hits[0]!.geonameId).toBe(1264527);
        expect(hits[0]!.timezone).toBe('Asia/Kolkata');
    });

    it('accepts a file: URL for the data directory', async () => {
        const fromUrl = await loadGazetteerFromDirectory(pathToFileURL(FIXTURE_DIR));
        expect(fromUrl.resolve('chennai')?.geonameId).toBe(1264527);
    });

    it('folds Latin diacritics for prefix search', () => {
        const withDiacritic = gazetteer.resolve('Chênnai');
        const plain = gazetteer.resolve('chennai');
        expect(withDiacritic?.geonameId).toBe(plain?.geonameId);
    });

    it('ranks every prefix hit by population, not by key order', () => {
        // Key order puts Paris, Ontario (pop 12k) next to Paris, France; both are exact.
        expect(gazetteer.resolve('paris')?.geonameId).toBe(2988507);
        expect(gazetteer.resolve('london')?.geonameId).toBe(2643743);
        expect(gazetteer.resolve('delhi')?.geonameId).toBe(1273294);
        expect(gazetteer.search('paris').map((h) => h.countryCode)).toEqual(['FR', 'CA']);
    });

    it('searches every bucket for a one-letter prefix', () => {
        const hits = gazetteer.search('p', { limit: 3 });
        expect(hits.map((h) => h.geonameId)).toEqual([2988507, 1260086, 2639835]);
    });

    it('keeps Indic vowel signs and kana voicing marks distinct', () => {
        expect(gazetteer.resolve('पटना')?.name).toBe('Patna');
        expect(gazetteer.resolve('पटनी')?.name).toBe('Putney');
        expect(gazetteer.resolve('बैरूत')?.name).toBe('Beirut');
        expect(gazetteer.resolve('बेरात')?.name).toBe('Berat');
        expect(gazetteer.resolve('ながの')?.name).toBe('Nagano');
        expect(gazetteer.resolve('なかの')?.name).toBe('Nakano');
    });

    it('returns nothing for a non-positive limit', () => {
        expect(gazetteer.search('chennai', { limit: 0 })).toEqual([]);
    });

    describe('query latency on loaded index', () => {
        it('keeps p95 search time under 5 ms in Node', () => {
            const samples = 2_000;
            const durations: number[] = [];
            const queries = ['chen', 'mad', 'चेन', 'chennai', 'madras', 'चेन्नई'];

            for (let i = 0; i < samples; i++) {
                const q = queries[i % queries.length];
                const start = performance.now();
                gazetteer.search(q, { limit: 8 });
                durations.push(performance.now() - start);
            }

            durations.sort((a, b) => a - b);
            const p95 = durations[Math.floor(samples * 0.95)];
            expect(p95).toBeLessThan(5);
        });
    });
});

describe('normalizeSearchKey', () => {
    it('folds Latin, Greek and Cyrillic accents and Arabic/Hebrew vowel points', () => {
        expect(normalizeSearchKey('  Köln ')).toBe('koln');
        expect(normalizeSearchKey('São   Paulo')).toBe('sao paulo');
        expect(normalizeSearchKey('Ἀθῆναι')).toBe(normalizeSearchKey('Αθηναι'));
        expect(normalizeSearchKey('Орёл')).toBe('орел');
        expect(normalizeSearchKey('بَيْرُوت')).toBe('بيروت');
        expect(normalizeSearchKey('יְרוּשָׁלַיִם')).toBe('ירושלים');
    });

    it('does not fold Indic vowel signs, viramas, Thai vowels or kana voicing marks', () => {
        expect(normalizeSearchKey('चेन्नई')).toBe('चेन्नई');
        expect(normalizeSearchKey('बैरूत')).not.toBe(normalizeSearchKey('बेरात'));
        expect(normalizeSearchKey('பூம்')).not.toBe(normalizeSearchKey('போமா'));
        expect(normalizeSearchKey('ดุสิต')).not.toBe(normalizeSearchKey('ดีสต์'));
        expect(normalizeSearchKey('ながの')).not.toBe(normalizeSearchKey('なかの'));
    });
});

describe('Gazetteer ranking', () => {
    it('ranks "chen" and "sao paulo" the way the full index does', async () => {
        const chen = [
            'Chengdu',
            'Chennai',
            'Chengtangcun',
            'Chenzhou',
            'Chengde',
            'Chengzhong',
            'Chenggu',
            'Chengqiao',
        ];
        const sao = [
            'São Paulo',
            'São Paulo de Olivença',
            'São Paulo de Frades',
            'São Paulo do Potengi',
            'São Paulo das Missões',
            'São Paulo Norte',
            'São Paulo Sul',
            'São Paulo Leste',
        ];
        const places: PlaceRecord[] = [
            ['Chengdu', 30.67, 104.07, 'Asia/Shanghai', 'CN', 'Sichuan', 20_937_757, 1],
            ['Chennai', 13.08, 80.27, 'Asia/Kolkata', 'IN', 'Tamil Nadu', 4_681_087, 2],
            ...chen
                .slice(2)
                .map((name, i): PlaceRecord => [
                    name,
                    0,
                    0,
                    'Asia/Shanghai',
                    'CN',
                    '',
                    900_000 - i * 10_000,
                    i + 3,
                ]),
            ['Zhengzhou', 0, 0, 'Asia/Shanghai', 'CN', 'Henan', 6_650_532, 90],
            ['São Paulo', -23.55, -46.64, 'America/Sao_Paulo', 'BR', 'São Paulo', 12_400_232, 100],
            ...sao
                .slice(1)
                .map((name, i): PlaceRecord => [
                    name,
                    0,
                    0,
                    'America/Sao_Paulo',
                    'BR',
                    '',
                    40_000 - i * 1_000,
                    101 + i,
                ]),
            ['Frei Paulo', 0, 0, 'America/Maceio', 'BR', '', 14_530, 200],
            ['Luanda', 0, 0, 'Africa/Luanda', 'AO', '', 2_776_168, 201],
            ['Diamante', 0, 0, 'America/Fortaleza', 'BR', '', 6_299, 202],
            ['Caatiba', 0, 0, 'America/Bahia', 'BR', '', 6_205, 203],
        ];
        const zhengzhou = places.findIndex((row) => row[0] === 'Zhengzhou');
        const saoStart = places.findIndex((row) => row[0] === 'São Paulo');
        const frei = places.findIndex((row) => row[0] === 'Frei Paulo');
        const luanda = places.findIndex((row) => row[0] === 'Luanda');
        const diamante = places.findIndex((row) => row[0] === 'Diamante');
        const caatiba = places.findIndex((row) => row[0] === 'Caatiba');

        function pack(rows: { key: string; index: number; kind: number }[]): IndexShardPayload {
            rows.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
            return {
                keys: rows.map((row) => row.key),
                placeIndexes: rows.map((row) => row.index),
                kinds: rows.map((row) => row.kind),
            };
        }

        const shards: Record<string, IndexShardPayload> = {
            'la-ch': pack([
                ...chen.map((name, index) => ({
                    key: normalizeSearchKey(name),
                    index,
                    kind: 0,
                })),
                { key: 'chengchow', index: zhengzhou, kind: 2 },
            ]),
            'la-sa': pack([
                ...sao.map((name, offset) => ({
                    key: normalizeSearchKey(name),
                    index: saoStart + offset,
                    kind: 0,
                })),
                { key: 'sao paulo', index: frei, kind: 2 },
                { key: 'sao paulo da assuncao de luanda', index: luanda, kind: 2 },
                { key: 'sao paulo', index: diamante, kind: 2 },
                { key: 'sao paulo', index: caatiba, kind: 2 },
            ]),
        };
        const manifest: GazetteerManifest = {
            version: 2,
            attribution: ATTRIBUTION_TEXT,
            license: 'CC-BY-4.0',
            geonamesUrl: 'https://www.geonames.org/',
            builtAt: '2026-01-01T00:00:00.000Z',
            placeCount: places.length,
            keyCount: 20,
            indexShards: { 'la-ch': 'index/la-ch.json', 'la-sa': 'index/la-sa.json' },
        };
        const gazetteer = await Gazetteer.open(
            manifest,
            places,
            async (id) => shards[id]!,
            Object.keys(shards),
        );

        const chenHits = gazetteer.search('chen', { limit: 8 }).map((hit) => hit.name);
        expect(chenHits.every((name) => name.startsWith('Chen'))).toBe(true);
        expect(chenHits[0]).toBe('Chengdu');
        expect(chenHits).toContain('Chennai');
        expect(chenHits).not.toContain('Zhengzhou');

        const saoHits = gazetteer.search('sao paulo', { limit: 8 });
        expect(saoHits[0]?.name).toBe('São Paulo');
        expect(saoHits[0]?.timezone).toBe('America/Sao_Paulo');
        expect(saoHits.every((hit) => hit.name.startsWith('São Paulo'))).toBe(true);
        for (const noise of ['Frei Paulo', 'Luanda', 'Diamante', 'Caatiba']) {
            expect(saoHits.map((hit) => hit.name)).not.toContain(noise);
        }
    });

    it('ranks a larger primary-name prefix ahead of a smaller exact name', async () => {
        const places: PlaceRecord[] = [
            ['Londonderry', 0, 0, 'UTC', 'GB', '', 1_000_000, 1],
            ['London', 0, 0, 'UTC', 'GB', '', 100, 2],
        ];
        const manifest: GazetteerManifest = {
            version: 1,
            attribution: ATTRIBUTION_TEXT,
            license: 'CC-BY-4.0',
            geonamesUrl: 'https://www.geonames.org/',
            builtAt: '2026-01-01T00:00:00.000Z',
            placeCount: 2,
            keyCount: 2,
            places: 'places.json',
            indexShards: { 'la-lo': 'index/la-lo.json' },
        };
        const shard: IndexShardPayload = {
            keys: ['london', 'londonderry'],
            placeIndexes: [1, 0],
            kinds: [0, 0],
        };
        const g = await Gazetteer.open(manifest, places, async () => shard);
        expect(g.search('london').map((h) => h.name)).toEqual(['Londonderry', 'London']);
        expect(g.search('lond').map((h) => h.geonameId)).toEqual([1, 2]);
    });
});
