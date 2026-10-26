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
 * Re-pinned: Lahiri mode 1 (37.76″ ICRC anchor), lahiri_icrc → SE mode 46, equatorial Vertex;
 * chart hash includes analytic body speeds (#281).
 */
const EXPECTED_HASHES: Record<string, string> = {
    '/v1/chart': '6e84aabde5122a8eae85254468129b480ae28b193cf93f4ecdc1f215a2d59f38',
    '/v1/shadbala': 'ae8a741916374ed5df82a810288a0a6abf035d5a0dee844cee2845810d1de61b',
    '/v1/kp/significators': 'df3e36794292ed38d6f43555862f1227a39650b3bf924b1961e707ce3c09eebe',
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
