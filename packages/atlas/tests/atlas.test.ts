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
    });

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
    it('prefers an exact name match over a larger place that only shares the prefix', async () => {
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
        const shard: IndexShardPayload = { keys: ['london', 'londonderry'], placeIndexes: [1, 0] };
        const g = await Gazetteer.open(manifest, places, async () => shard);
        expect(g.resolve('London')?.geonameId).toBe(2);
        expect(g.search('lond').map((h) => h.geonameId)).toEqual([1, 2]);
    });
});
