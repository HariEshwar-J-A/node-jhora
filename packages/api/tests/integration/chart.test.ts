/**
 * Integration tests — city-based geocoding via POST /v1/chart
 *
 * These tests verify that the geocoder middleware correctly resolves city names
 * to coordinates/timezones and propagates errors as the expected HTTP status codes.
 */

import { buildServer, initEngine } from '../../src/server.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
    await initEngine();
    app = await buildServer({ logger: false });
    await app.ready();
}, 30000);

afterAll(async () => {
    await app.close();
});

describe('POST /v1/chart — city-based geocoding', () => {

    test('Hamilton, Ontario resolves to America/Toronto', async () => {
        const res = await app.inject({
            method: 'POST',
            url:    '/v1/chart',
            payload: {
                city:     'Hamilton, Ontario',
                date:     '1990-06-15',
                time:     '08:30:00',
                ayanamsa: 'lahiri',
            },
        });

        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(body.meta.resolvedCity).toMatch(/Hamilton/);
        expect(body.meta.resolvedTimezone).toBe('America/Toronto');
        // Hamilton, ON ≈ 43.25°N, -79.87°E
        expect(body.meta.resolvedLat).toBeCloseTo(43.25, 0);
        expect(body.meta.resolvedLon).toBeCloseTo(-79.87, 0);
    });

    test('Bare "Hamilton" returns 400 with suggestions (multiple timezones) or 200 (auto-picked)', async () => {
        const res = await app.inject({
            method: 'POST',
            url:    '/v1/chart',
            payload: { city: 'Hamilton', date: '1990-06-15', time: '08:30:00' },
        });

        // Hamilton appears in ON (America/Toronto), Bermuda (Atlantic/Bermuda),
        // NZ (Pacific/Auckland), OH (America/New_York) — timezones differ → 400.
        // If city-timezones data collapses to a single timezone, auto-pick is fine (200).
        if (res.statusCode === 400) {
            const body = JSON.parse(res.body);
            expect(body.type).toBe('ambiguous_city');
            expect(Array.isArray(body.suggestions)).toBe(true);
            expect(body.suggestions.length).toBeGreaterThan(1);
        } else {
            expect(res.statusCode).toBe(200);
        }
    });

    test('Missing both city and coordinates returns 422', async () => {
        const res = await app.inject({
            method: 'POST',
            url:    '/v1/chart',
            payload: { date: '1990-06-15', time: '08:30:00' },
        });
        // Zod .refine() fails — treated as validation error → 422
        expect(res.statusCode).toBe(422);
    });

    test('Unknown city returns 404', async () => {
        const res = await app.inject({
            method: 'POST',
            url:    '/v1/chart',
            payload: {
                city: 'Xyznonexistentcity12345',
                date: '1990-06-15',
                time: '08:30:00',
            },
        });
        expect(res.statusCode).toBe(404);
        const body = JSON.parse(res.body);
        expect(body.type).toBe('city_not_found');
    });

    test('Explicit lat/lon/tz still works (no regression)', async () => {
        const res = await app.inject({
            method: 'POST',
            url:    '/v1/chart',
            payload: {
                date:      '1985-07-12',
                time:      '00:30:00',
                latitude:  28.6139,
                longitude: 77.2090,
                timezone:  'Asia/Kolkata',
                ayanamsa:  'lahiri',
            },
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.body);
        expect(Array.isArray(body.planets)).toBe(true);
        expect(body.meta.resolvedCity).toBeUndefined();
    });
});
