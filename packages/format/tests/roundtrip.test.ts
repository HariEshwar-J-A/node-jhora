import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseNjh, roundTripNjh, serializeNjh } from '../src/index.js';

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/sample-v2.json');

describe('njh round-trip', () => {
    it('is lossless on parse → serialize → parse', () => {
        const raw = readFileSync(fixturePath, 'utf8');
        const chart = roundTripNjh(raw);
        expect(chart.metadata.name).toBe('Sample Chart');
        expect(chart.birth.tzResolution.resolvedUtc).toBe('2000-01-01T12:00:00Z');
        const again = serializeNjh(chart);
        expect(parseNjh(again)).toEqual(chart);
    });

    it('rejects an invalid IANA zone', () => {
        const chart = parseNjh(readFileSync(fixturePath, 'utf8'));
        const broken = {
            ...chart,
            birth: { ...chart.birth, timezone: 'Not/A_Real_Zone' },
        };
        expect(() => parseNjh(broken)).toThrow();
    });

    it('is lossless for unicode names, notes, tags, and every attachment kind', () => {
        const base = parseNjh(readFileSync(fixturePath, 'utf8'));
        const chart = {
            ...base,
            metadata: {
                ...base.metadata,
                name: 'ஸ்ரீநிவாச ராமானுஜன் / श्रीनिवास 🪐 Zoë Ångström',
                aliases: ['e\u0301 (combining)', 'é (precomposed)', 'עברית', '𝔘𝔫𝔦𝔠𝔬𝔡𝔢', ''],
                notes: 'Line 1\nLine 2\t"quoted" \\ backslash \u2028 sep',
            },
            tags: ['తెలుగు', '中文', '🔭'],
            rectification: {
                notes: [
                    {
                        text: 'జన్మ సమయం ±2 నిమిషాలు',
                        createdAt: '2026-10-26T04:00:00.123456789Z',
                        author: 'José',
                    },
                ],
            },
            attachments: [
                {
                    id: '6f1c1d36-5d0a-4a52-9a43-1c1b6d1e2f30',
                    kind: 'url' as const,
                    ref: 'https://example.com/ఫైల్.pdf?q=1&r=ü',
                    label: 'జాతకం',
                    mediaType: 'application/pdf',
                },
                {
                    id: '0b7f6f0e-9b4e-4f6e-8f3a-2c3d4e5f6a7b',
                    kind: 'relative_path' as const,
                    ref: 'scans/जन्म पत्री.jpg',
                },
                {
                    id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
                    kind: 'content_hash' as const,
                    ref: 'sha256:' + 'ab'.repeat(32),
                },
            ],
        };
        const text = serializeNjh(chart);
        const back = roundTripNjh(text);
        expect(back).toEqual(parseNjh(chart));
        expect(back.metadata.name).toBe(chart.metadata.name);
        expect(back.metadata.aliases).toEqual(chart.metadata.aliases);
        expect(back.metadata.aliases[0]).not.toBe(back.metadata.aliases[1]); // no NFC/NFD folding
        expect(back.attachments).toEqual(chart.attachments);
        expect(back.rectification.notes[0].createdAt).toBe('2026-10-26T04:00:00.123456789Z');
        expect(serializeNjh(back)).toBe(text);
    });
});
