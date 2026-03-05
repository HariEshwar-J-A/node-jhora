/**
 * API Integration Tests
 *
 * These tests spin up the Fastify server in-process (no network) and exercise
 * every endpoint with the Reference Chart B (1985-07-12, New Delhi).
 */

import { buildServer, initEngine } from '../src/server.js';
import type { FastifyInstance } from 'fastify';

// Reference Chart B — verified against Swiss Ephemeris output
const CHART_B_BODY = {
    date:      '1985-07-12',
    time:      '00:30:00',
    latitude:  28.6139,
    longitude: 77.2090,
    timezone:  'Asia/Kolkata',
    ayanamsa:  'lahiri',
    nodeType:  'mean',
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

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

describe('GET /health', () => {
    test('returns 200 with status ok', async () => {
        const res = await app.inject({ method: 'GET', url: '/health' });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(body.status).toBe('ok');
        expect(typeof body.uptime).toBe('number');
    });
});

// ---------------------------------------------------------------------------
// Chart
// ---------------------------------------------------------------------------

describe('POST /v1/chart', () => {
    test('returns 200 with planets, houses, panchanga', async () => {
        const res = await app.inject({
            method: 'POST',
            url:    '/v1/chart',
            payload: CHART_B_BODY,
        });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(Array.isArray(body.planets)).toBe(true);
        expect(body.planets.length).toBe(9); // 7 planets + Rahu + Ketu
        expect(body.houses).toBeDefined();
        expect(body.houses.ascendant).toBeGreaterThan(0);
        expect(body.panchanga).toBeDefined();
        expect(body.panchanga.tithi).toBeDefined();
    });

    test('planets have required fields', async () => {
        const res = await app.inject({ method: 'POST', url: '/v1/chart', payload: CHART_B_BODY });
        const { planets } = res.json();
        const sun = planets.find((p: any) => p.id === 0);
        expect(sun).toBeDefined();
        expect(typeof sun.longitude).toBe('number');
        expect(sun.longitude).toBeGreaterThanOrEqual(0);
        expect(sun.longitude).toBeLessThan(360);
        expect(sun.sign).toBeGreaterThanOrEqual(1);
        expect(sun.sign).toBeLessThanOrEqual(12);
    });

    test('returns 422 for invalid date format', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/v1/chart',
            payload: { ...CHART_B_BODY, date: '12-07-1985' },
        });
        expect(res.statusCode).toBe(422);
        const body = res.json();
        expect(body.status).toBe(422);
        expect(body.errors).toBeDefined();
    });

    test('returns 422 for out-of-range latitude', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/v1/chart',
            payload: { ...CHART_B_BODY, latitude: 95 },
        });
        expect(res.statusCode).toBe(422);
    });
});

// ---------------------------------------------------------------------------
// Chart vargas
// ---------------------------------------------------------------------------

describe('POST /v1/chart/vargas', () => {
    test('returns all 16 divisional charts', async () => {
        const res = await app.inject({ method: 'POST', url: '/v1/chart/vargas', payload: CHART_B_BODY });
        expect(res.statusCode).toBe(200);
        const { vargas } = res.json();
        const DIVISIONS = ['D1','D2','D3','D4','D7','D9','D10','D12','D16','D20','D24','D27','D30','D40','D45','D60'];
        for (const d of DIVISIONS) {
            expect(vargas[d]).toBeDefined();
            expect(Array.isArray(vargas[d])).toBe(true);
        }
    });
});

// ---------------------------------------------------------------------------
// Panchanga
// ---------------------------------------------------------------------------

describe('POST /v1/panchanga', () => {
    test('returns all 5 panchanga elements', async () => {
        const res = await app.inject({ method: 'POST', url: '/v1/panchanga', payload: CHART_B_BODY });
        expect(res.statusCode).toBe(200);
        const p = res.json();
        expect(p.tithi).toBeDefined();
        expect(p.nakshatra).toBeDefined();
        expect(p.yoga).toBeDefined();
        expect(p.karana).toBeDefined();
        expect(p.vara).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// Dasha
// ---------------------------------------------------------------------------

describe('POST /v1/dasha', () => {
    test('returns balance and mahadashas with depth 1', async () => {
        const res = await app.inject({
            method: 'POST', url: '/v1/dasha',
            payload: { ...CHART_B_BODY, depth: 1 },
        });
        expect(res.statusCode).toBe(200);
        const { balance, periods } = res.json();
        expect(balance.lord).toBeDefined();
        expect(typeof balance.yearsRemaining).toBe('number');
        expect(Array.isArray(periods)).toBe(true);
        expect(periods.length).toBeGreaterThanOrEqual(9);
    });

    test('returns antardasha with depth 2', async () => {
        const res = await app.inject({
            method: 'POST', url: '/v1/dasha',
            payload: { ...CHART_B_BODY, depth: 2 },
        });
        const { periods } = res.json();
        expect(periods[0].subPeriods.length).toBeGreaterThan(0);
    });

    test('start/end are ISO strings', async () => {
        const res = await app.inject({
            method: 'POST', url: '/v1/dasha',
            payload: { ...CHART_B_BODY, depth: 1 },
        });
        const { periods } = res.json();
        expect(typeof periods[0].start).toBe('string');
        expect(typeof periods[0].end).toBe('string');
        expect(periods[0].start).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
});

// ---------------------------------------------------------------------------
// Shadbala
// ---------------------------------------------------------------------------

describe('POST /v1/shadbala', () => {
    test('returns shadbala for 7 classical planets', async () => {
        const res = await app.inject({ method: 'POST', url: '/v1/shadbala', payload: CHART_B_BODY });
        expect(res.statusCode).toBe(200);
        const { shadbala } = res.json();
        expect(Array.isArray(shadbala)).toBe(true);
        expect(shadbala.length).toBe(7); // Sun–Saturn
    });

    test('each planet has all 6 Shadbala components', async () => {
        const res = await app.inject({ method: 'POST', url: '/v1/shadbala', payload: CHART_B_BODY });
        const { shadbala } = res.json();
        const sun = shadbala.find((p: any) => p.planetId === 0);
        expect(sun.components.sthana).toBeDefined();
        expect(sun.components.dig).toBeDefined();
        expect(sun.components.kaala).toBeDefined();
        expect(sun.components.chesta).toBeDefined();
        expect(sun.components.naisargika).toBeCloseTo(60, 1); // Sun always 60
        expect(sun.components.drig).toBeDefined();
    });
});

// ---------------------------------------------------------------------------
// KP Significators
// ---------------------------------------------------------------------------

describe('POST /v1/kp/significators', () => {
    test('returns KP lords for all planets', async () => {
        const res = await app.inject({ method: 'POST', url: '/v1/kp/significators', payload: CHART_B_BODY });
        expect(res.statusCode).toBe(200);
        const { significators } = res.json();
        expect(Array.isArray(significators)).toBe(true);
        expect(significators.length).toBe(9); // 7 planets + Rahu + Ketu
    });

    test('each significator has sign/star/sub/subsub lords', async () => {
        const res = await app.inject({ method: 'POST', url: '/v1/kp/significators', payload: CHART_B_BODY });
        const { significators } = res.json();
        for (const sig of significators) {
            expect(sig.signLord).toBeDefined();
            expect(sig.starLord).toBeDefined();
            expect(sig.subLord).toBeDefined();
            expect(sig.subSubLord).toBeDefined();
            expect(typeof sig.signLord.id).toBe('number');
        }
    });
});

// ---------------------------------------------------------------------------
// Match (Kundali compatibility)
// ---------------------------------------------------------------------------

describe('POST /v1/match', () => {
    const MATCH_BODY = {
        person1: CHART_B_BODY,
        person2: { ...CHART_B_BODY, date: '1987-03-15', time: '10:00:00' },
    };

    test('returns compatibility result', async () => {
        const res = await app.inject({ method: 'POST', url: '/v1/match', payload: MATCH_BODY });
        expect(res.statusCode).toBe(200);
        const body = res.json();
        expect(typeof body.totalScore).toBe('number');
        expect(typeof body.maxTotal).toBe('number');
        expect(typeof body.isRecommended).toBe('boolean');
        expect(Array.isArray(body.matches)).toBe(true);
    });
});
