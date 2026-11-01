import { buildServer, initEngine } from '../../src/server.js';
import type { FastifyInstance } from 'fastify';

const CHART_BODY = {
    date: '1985-07-12',
    time: '00:30:00',
    latitude: 28.6139,
    longitude: 77.209,
    timezone: 'Asia/Kolkata',
    ayanamsa: 'lahiri',
    nodeType: 'mean',
    houseSystem: 'whole_sign',
};

let app: FastifyInstance;

beforeAll(async () => {
    await initEngine();
    app = await buildServer({ logger: false });
    await app.ready();
}, 30000);

afterAll(async () => {
    await app.close();
});

describe('customAyanamsaMode validation', () => {
    test('registered mode 30 (Gil Brand) returns 200', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/v1/chart',
            payload: { ...CHART_BODY, customAyanamsaMode: 30 },
        });
        expect(res.statusCode).toBe(200);
    });

    test.each([99, -1])('unknown mode %i returns 4xx, not 500', async (mode) => {
        const res = await app.inject({
            method: 'POST',
            url: '/v1/chart',
            payload: { ...CHART_BODY, customAyanamsaMode: mode },
        });
        expect(res.statusCode).toBeGreaterThanOrEqual(400);
        expect(res.statusCode).toBeLessThan(500);
    });

    test('non-integer customAyanamsaMode returns 422', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/v1/chart',
            payload: { ...CHART_BODY, customAyanamsaMode: 1.5 },
        });
        expect(res.statusCode).toBe(422);
    });

    test('NaN customAyanamsaMode returns 422', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/v1/chart',
            payload: { ...CHART_BODY, customAyanamsaMode: Number.NaN },
        });
        expect(res.statusCode).toBe(422);
    });
});
