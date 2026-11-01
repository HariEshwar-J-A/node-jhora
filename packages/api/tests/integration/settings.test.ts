/**
 * Integration tests — calculation settings over HTTP: the `true_chitra` /
 * `true_citra` alias, preset ids, and the optional `settingsHash` field.
 */

import {
    DELTA_T_MODEL,
    ENGINE_VERSION,
    EPHEMERIS_PROVIDER,
    TZDB_VERSION,
    getPreset,
    hashSettings,
} from '@node-jhora/core';
import { buildServer, initEngine } from '../../src/server.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

const birth = {
    date: '2020-12-21',
    time: '10:30:00',
    latitude: 25.3176,
    longitude: 82.9739,
    timezone: 'Asia/Kolkata',
};

async function post(url: string, payload: Record<string, unknown>) {
    const res = await app.inject({ method: 'POST', url, payload });
    return { status: res.statusCode, body: JSON.parse(res.body) };
}

beforeAll(async () => {
    await initEngine();
    app = await buildServer({ logger: false });
    await app.ready();
}, 30000);

afterAll(async () => {
    await app.close();
});

function expectEnvelope(body: Record<string, unknown>, settingsHash: string) {
    expect(body.engineVersion).toBe(ENGINE_VERSION);
    expect(body.settingsHash).toBe(settingsHash);
    expect(body.ephemerisProvider).toBe(EPHEMERIS_PROVIDER);
    expect(body.tzdbVersion).toBe(TZDB_VERSION);
    expect(body.deltaTModel).toBe(DELTA_T_MODEL);
    expect(body.warnings).toEqual([]);
    expect(body).not.toHaveProperty('computedAt');
}

describe('result envelope', () => {
    test('chart responses include provenance without computedAt', async () => {
        const res = await post('/v1/chart', birth);
        expect(res.status).toBe(200);
        expectEnvelope(res.body, hashSettings(getPreset('node-jhora-default')));
    });
});

describe('true_chitra / true_citra alias', () => {
    test('both spellings give the same planets, ayanamsa, and settingsHash', async () => {
        const chitra = await post('/v1/chart', { ...birth, ayanamsa: 'true_chitra' });
        const citra = await post('/v1/chart', { ...birth, ayanamsa: 'true_citra' });
        expect(chitra.status).toBe(200);
        expect(citra.status).toBe(200);
        expect(citra.body.planets).toEqual(chitra.body.planets);
        expect(citra.body.meta.ayanamsaValue).toBe(chitra.body.meta.ayanamsaValue);
        expect(citra.body.settingsHash).toBe(chitra.body.settingsHash);
    });

    test('a request with no settings hashes as node-jhora-default', async () => {
        const res = await post('/v1/chart', birth);
        expect(res.status).toBe(200);
        expect(res.body.settingsHash).toBe(hashSettings(getPreset('node-jhora-default')));
    });

    test('settings.ayanamsa true_citra matches the true_chitra field', async () => {
        const viaField = await post('/v1/chart', { ...birth, ayanamsa: 'true_chitra' });
        const viaSettings = await post('/v1/chart', {
            ...birth,
            settings: { ayanamsa: 'true_citra' },
        });
        expect(viaSettings.status).toBe(200);
        expect(viaSettings.body.planets).toEqual(viaField.body.planets);
    });
});

describe('presets over HTTP', () => {
    test("a preset id stamps that preset's hash", async () => {
        const res = await post('/v1/dasha', { ...birth, preset: 'jhora-default@8.0' });
        expect(res.status).toBe(200);
        expect(res.body.settingsHash).toBe(hashSettings(getPreset('jhora-default@8.0')));
    });

    test('an unknown preset id fails validation (422)', async () => {
        const res = await post('/v1/chart', { ...birth, preset: 'no-such-preset' });
        expect(res.status).toBe(422);
    });
});
