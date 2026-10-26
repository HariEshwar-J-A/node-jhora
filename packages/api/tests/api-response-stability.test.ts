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
 * Re-pinned for E3-ACC (#255): JHora-DLL parity changes sub-arcsecond values.
 */
const EXPECTED_HASHES: Record<string, string> = {
    '/v1/chart': '2edbf1b088c76e71f4db6dc02be66a3b597f2afb5f1ac6290cc92190412d774d',
    '/v1/shadbala': '72fc38f257533ced8a97937c9c69a5a71d69e503f76be6d610ea9abc40673fd7',
    '/v1/kp/significators': '276b342f80f8b52d2cdd55bd925641d501b4e0b59e3aafd22c71ed3aebeea894',
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
