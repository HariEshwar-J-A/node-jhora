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
    longitude: 77.2090,
    timezone: 'Asia/Kolkata',
    ayanamsa: 'lahiri',
    nodeType: 'mean',
    houseSystem: 'whole_sign',
};

/**
 * SHA-256 of canonical JSON with volatile envelope fields removed.
 * Re-pinned after #260 added `ephemerisPolicy` (default `auto`) to CalculationSettings:
 * only `settingsHash` changed (d9d9dac978004ca9 → 73e104c667187242); all calculation
 * output is byte-identical to the previous pins.
 */
const EXPECTED_HASHES: Record<string, string> = {
    '/v1/chart': 'f900db70d2c849f61a9ce7f451cf44b5785047d304456397c089b8dd61ee72c8',
    '/v1/shadbala': 'e643bb53a0d805972dd6ba2741cfe22d8c63de9ef8bf812f14b65203b2aed39f',
    '/v1/kp/significators': '258b95eeb3fed32eb6665cfa5db202579be9ebefcc156b3701c3a7cb491f4b9e',
};

function stripVolatileEnvelope(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(stripVolatileEnvelope);
    if (value !== null && typeof value === 'object') {
        const source = value as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(source)) {
            if (['computedAt', 'uptime', 'engineVersion', 'tzdbVersion', 'ephemerisProvider', 'deltaTModel', 'warnings'].includes(key)) {
                continue;
            }
            out[key] = stripVolatileEnvelope(val);
        }
        return out;
    }
    return value;
}

function responseHash(body: unknown): string {
    return createHash('sha256').update(canonicalJson(stripVolatileEnvelope(body))).digest('hex');
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
