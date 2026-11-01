/**
 * Locks public API JSON shapes and numeric body ids against accidental drift.
 * Hashes exclude envelope metadata that varies by build or wall clock.
 */

import { createHash } from 'node:crypto';

import { canonicalJson } from '@node-jhora/core';
import { buildServer, initEngine } from '../src/server.js';
import type { FastifyInstance } from 'fastify';

const CHART_B_BODY = {
    date: '1985-07-12',
    time: '00:30:00',
    latitude: 28.6139,
    longitude: 77.209,
    timezone: 'Asia/Kolkata',
    ayanamsa: 'lahiri',
    nodeType: 'mean',
    houseSystem: 'whole_sign',
};

/**
 * SHA-256 of canonical JSON with volatile envelope fields removed.
 * Re-pinned: Lahiri IAE 1956 anchor + traditional ecliptic-of-t0 (ADR 0015).
 */
const EXPECTED_HASHES: Record<string, string> = {
    '/v1/chart': 'e238fd37422ecfc42d6e756bd31ccfcbc80e9fbb7f7704b1c2b6ca8d98a06d70',
    '/v1/shadbala': 'c35778ed1735f6c4f18435b4c5dd4f190903492bf2c9a48b686b7fc04c71dd06',
    '/v1/kp/significators': 'a3704020ea2c849b252367f19c7bd230c5550fa59a074778ce938f5bbdd3b784',
};

function stripVolatileEnvelope(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stripVolatileEnvelope);
    if (value !== null && typeof value === 'object') {
        const source = value as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(source)) {
            if (
                [
                    'computedAt',
                    'uptime',
                    'engineVersion',
                    'tzdbVersion',
                    'ephemerisProvider',
                    'deltaTModel',
                    'warnings',
                ].includes(key)
            ) {
                continue;
            }
            out[key] = stripVolatileEnvelope(val);
        }
        return out;
    }
    return value;
}

function responseHash(body: unknown): string {
    return createHash('sha256')
        .update(canonicalJson(stripVolatileEnvelope(body)))
        .digest('hex');
}

let app: FastifyInstance;

beforeAll(async () => {
    await initEngine();
    app = await buildServer({ logger: false });
    await app.ready();
}, 30000);

afterAll(async () => {
    await app.close();
});

describe('API response stability (body ids and calculation output)', () => {
    for (const [path, expected] of Object.entries(EXPECTED_HASHES)) {
        test(`${path} matches regression hash`, async () => {
            const res = await app.inject({ method: 'POST', url: path, payload: CHART_B_BODY });
            expect(res.statusCode).toBe(200);
            expect(responseHash(res.json())).toBe(expected);
        });
    }

    test('chart planets expose canonical Rahu/Ketu ids', async () => {
        const res = await app.inject({ method: 'POST', url: '/v1/chart', payload: CHART_B_BODY });
        const { planets } = res.json();
        expect(planets.find((p: { name: string }) => p.name === 'Rahu')?.id).toBe(10);
        expect(planets.find((p: { name: string }) => p.name === 'Ketu')?.id).toBe(99);
    });
});
