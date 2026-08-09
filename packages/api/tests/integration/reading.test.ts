/**
 * Integration tests for the two composite endpoints, `/v1/transits` and
 * `/v1/reading`.
 *
 * These exist to protect the relationships a client would otherwise have to
 * re-derive, and which are easy to get subtly wrong:
 *
 *   - `houseFromLordAbove`, which decides *which conditional branch* of a
 *     classical dasha verse applies. Wrong by one and the reading inverts.
 *   - Transit houses counted from the natal Moon rather than the ascendant.
 *   - Sade Sati versus Kantaka Shani, which are different afflictions.
 *
 * Reference chart: 1998-12-06 09:23 IST, Chennai — the same one pinned against
 * a real JHora export in the core suite.
 */

import { buildServer, initEngine } from '../../src/server.js';

const BIRTH = {
    date: '1998-12-06',
    time: '09:23:00',
    latitude: 13.0833,
    longitude: 80.2833,
    timezone: 'Asia/Kolkata',
};

let app: Awaited<ReturnType<typeof buildServer>>;

beforeAll(async () => {
    await initEngine();
    app = await buildServer({ logger: false });
    await app.ready();
}, 60_000);

afterAll(async () => { await app?.close(); });

async function post(url: string, payload: Record<string, unknown>) {
    const res = await app.inject({ method: 'POST', url, payload });
    return { status: res.statusCode, body: res.json() as any };
}

describe('POST /v1/reading', () => {
    test('returns the dasha stack down to Pratyantardasha', async () => {
        const { status, body } = await post('/v1/reading', { ...BIRTH, asOf: '2026-08-09T12:00:00+05:30' });
        expect(status).toBe(200);

        const levels = body.dashaStack.map((s: any) => s.levelName);
        expect(levels).toEqual(['Mahadasha', 'Antardasha', 'Pratyantardasha']);

        // Verified against the native's own JHora export.
        expect(body.dashaStack[0].lord).toBe('Saturn');
        expect(body.dashaStack[1].lord).toBe('Jupiter');
    }, 60_000);

    test('each period contains asOf, and nests inside its parent', async () => {
        const asOf = '2026-08-09T12:00:00+05:30';
        const { body } = await post('/v1/reading', { ...BIRTH, asOf });
        const t = new Date(asOf).getTime();

        let prevStart = -Infinity, prevEnd = Infinity;
        for (const s of body.dashaStack) {
            const start = new Date(s.start).getTime();
            const end = new Date(s.end).getTime();
            expect(t).toBeGreaterThanOrEqual(start);
            expect(t).toBeLessThan(end);
            // A sub-period cannot extend outside the period containing it.
            expect(start).toBeGreaterThanOrEqual(prevStart);
            expect(end).toBeLessThanOrEqual(prevEnd);
            prevStart = start; prevEnd = end;
        }
    }, 60_000);

    test('houseFromLordAbove is absent at Mahadasha and 1-12 below it', async () => {
        const { body } = await post('/v1/reading', BIRTH);

        expect(body.dashaStack[0].houseFromLordAbove).toBeNull();
        expect(body.dashaStack[0].classicalBranch).toBeNull();

        for (const s of body.dashaStack.slice(1)) {
            expect(s.houseFromLordAbove).toBeGreaterThanOrEqual(1);
            expect(s.houseFromLordAbove).toBeLessThanOrEqual(12);
            expect(['favourable', 'adverse', 'mixed']).toContain(s.classicalBranch);
        }
    }, 60_000);

    test('the branch label agrees with the house it was derived from', async () => {
        const { body } = await post('/v1/reading', BIRTH);
        for (const s of body.dashaStack.slice(1)) {
            const h = s.houseFromLordAbove;
            if ([6, 8, 12].includes(h)) expect(s.classicalBranch).toBe('adverse');
            else if ([1, 2, 4, 5, 7, 9, 10, 11].includes(h)) expect(s.classicalBranch).toBe('favourable');
            else expect(s.classicalBranch).toBe('mixed');
        }
    }, 60_000);

    test('natal dignities are reported, including debilitation', async () => {
        const { body } = await post('/v1/reading', BIRTH);
        const saturn = body.natal.planets.find((p: any) => p.name === 'Saturn');
        // Saturn is in Aries for this chart, its sign of debilitation.
        expect(saturn.signName).toBe('Aries');
        expect(saturn.dignity).toBe('debilitated');
    }, 60_000);

    test('every planet carries the houses it rules for this ascendant', async () => {
        const { body } = await post('/v1/reading', BIRTH);
        const jup = body.natal.planets.find((p: any) => p.name === 'Jupiter');
        // Capricorn ascendant: Jupiter rules Sagittarius and Pisces, the 12th and 3rd.
        expect([...jup.rulesHouses].sort((a: number, b: number) => a - b)).toEqual([3, 12]);
    }, 60_000);
});

describe('POST /v1/transits', () => {
    test('houses are counted from the natal Moon, not the ascendant', async () => {
        const { status, body } = await post('/v1/transits', BIRTH);
        expect(status).toBe(200);

        for (const p of body.planets) {
            expect(p.houseFromMoon).toBeGreaterThanOrEqual(1);
            expect(p.houseFromMoon).toBeLessThanOrEqual(12);
            // The two references differ unless Moon and lagna share a sign.
            const offset = ((body.natal.moonSign - body.natal.ascendantSign) % 12 + 12) % 12;
            if (offset !== 0) expect(p.houseFromMoon).not.toBe(p.houseFromLagna);
        }
    }, 120_000);

    test('Sade Sati and Kantaka Shani are distinguished', async () => {
        const { body } = await post('/v1/transits', BIRTH);
        const s = body.sadeSati;

        // Mutually exclusive: 12/1/2 from the Moon versus 4/7/10.
        expect(s.active && s.kantakaShani).toBe(false);
        if (s.active) expect([12, 1, 2]).toContain(s.houseFromMoon);
        if (s.kantakaShani) expect([4, 7, 10]).toContain(s.houseFromMoon);
        if (s.ashtamaShani) expect(s.houseFromMoon).toBe(8);
    }, 120_000);

    test('ingress times are ordered and inside the requested horizon', async () => {
        const { body } = await post('/v1/transits', { ...BIRTH, horizonDays: 400 });
        const asOf = new Date(body.asOf).getTime();
        const limit = asOf + 400 * 86_400_000;

        let prev = asOf;
        for (const u of body.upcoming) {
            const at = new Date(u.at).getTime();
            expect(at).toBeGreaterThanOrEqual(asOf);
            expect(at).toBeLessThanOrEqual(limit);
            expect(at).toBeGreaterThanOrEqual(prev);
            prev = at;
        }
    }, 180_000);

    test('rejects a request with no location', async () => {
        const res = await app.inject({
            method: 'POST', url: '/v1/transits',
            payload: { date: '1998-12-06', time: '09:23:00' },
        });
        expect(res.statusCode).toBeGreaterThanOrEqual(400);
    }, 30_000);
});
