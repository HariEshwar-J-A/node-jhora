/**
 * Transit ingress accuracy.
 *
 * Two defects made reported ingress times wrong while looking precise:
 *
 *   1. No refinement. The scan reported the end of the step in which a crossing
 *      was detected, so a 24-hour scan was up to a day late.
 *   2. A hardcoded ayanamsa. `getPos` used Lahiri regardless of the caller, so
 *      against a True Chitrapaksha chart every longitude was shifted 0.0203°.
 *      For Saturn that is five hours of motion.
 *
 * Both produced a timestamp to the second that was hours or a day out — the
 * worst kind of wrong, because it invites being quoted exactly.
 */

import { DateTime }         from 'luxon';
import { EphemerisEngine }  from '@node-jhora/core';
import { TransitEngine }    from '../../src/transits.js';

let engine: EphemerisEngine;

beforeAll(async () => {
    engine = EphemerisEngine.getInstance();
    await engine.initialize();
}, 30_000);

/** Longitude of a body at an instant, in a given zodiac. */
function lon(planetId: number, t: DateTime, ayanamsaOrder: number): number {
    const ps = engine.getPlanets(t, { latitude: 0, longitude: 0 }, { ayanamsaOrder });
    return ps.find(p => p.id === planetId)!.longitude;
}

/** Independently bisect the true moment a body crosses a 30° sign boundary. */
function trueSignIngress(planetId: number, lo: DateTime, hi: DateTime, ayanamsaOrder: number): DateTime {
    const bucket = (t: DateTime) => Math.floor(lon(planetId, t, ayanamsaOrder) / 30);
    const start = bucket(lo);
    let a = lo, b = hi;
    for (let i = 0; i < 40; i++) {
        const mid = DateTime.fromMillis((a.toMillis() + b.toMillis()) / 2, { zone: a.zone });
        if (bucket(mid) === start) a = mid; else b = mid;
    }
    return b;
}

describe('TransitEngine: sign ingress timing', () => {
    const SATURN = 6;
    const TRUE_CHITRA = 27;

    test('ingress is accurate to within a minute, not a step', async () => {
        const start = DateTime.fromISO('2027-05-20T00:00:00+05:30');
        const end   = DateTime.fromISO('2027-06-20T00:00:00+05:30');

        const te = new TransitEngine(engine, { ayanamsaOrder: TRUE_CHITRA });
        const events = (await te.findTransits(SATURN, start, end, 24))
            .filter(e => e.type === 'Sign');

        expect(events.length).toBeGreaterThan(0);

        const expected = trueSignIngress(SATURN, start, end, TRUE_CHITRA);
        const errorSec = Math.abs(events[0].time.toMillis() - expected.toMillis()) / 1000;

        // A 24-hour scan step must not leak into the answer.
        expect(errorSec).toBeLessThan(60);
    }, 120_000);

    test('the reported instant actually sits on the boundary', async () => {
        const start = DateTime.fromISO('2027-05-20T00:00:00+05:30');
        const end   = DateTime.fromISO('2027-06-20T00:00:00+05:30');

        const te = new TransitEngine(engine, { ayanamsaOrder: TRUE_CHITRA });
        const ev = (await te.findTransits(SATURN, start, end, 24)).find(e => e.type === 'Sign')!;

        // Just before, still in the old sign; just after, in the new one.
        const before = lon(SATURN, ev.time.minus({ hours: 2 }), TRUE_CHITRA);
        const after  = lon(SATURN, ev.time.plus({ hours: 2 }),  TRUE_CHITRA);
        expect(Math.floor(before / 30)).toBe(ev.prevValue);
        expect(Math.floor(after  / 30)).toBe(ev.newValue);
    }, 120_000);

    test('the ayanamsa is the caller\'s, not a hardcoded Lahiri', async () => {
        const start = DateTime.fromISO('2027-05-01T00:00:00+05:30');
        const end   = DateTime.fromISO('2027-07-15T00:00:00+05:30');

        const chitra = new TransitEngine(engine, { ayanamsaOrder: 27 });
        const lahiri = new TransitEngine(engine, { ayanamsaOrder: 1 });

        const a = (await chitra.findTransits(SATURN, start, end, 24)).find(e => e.type === 'Sign')!;
        const b = (await lahiri.findTransits(SATURN, start, end, 24)).find(e => e.type === 'Sign')!;

        // The two zodiacs differ by ~0.02°, which for Saturn is hours. If the
        // engine ignored the option these would be identical.
        const gapHours = Math.abs(a.time.toMillis() - b.time.toMillis()) / 3_600_000;
        expect(gapHours).toBeGreaterThan(1);
        expect(gapHours).toBeLessThan(24);
    }, 180_000);
});
