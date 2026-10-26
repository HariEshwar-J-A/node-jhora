import { TransitScanner } from '../src/index.js';
import { EphemerisEngine } from '@node-jhora/core';
import { DateTime } from 'luxon';

describe('TransitScanner', () => {
    let engine: EphemerisEngine;
    let scanner: TransitScanner;

    beforeAll(async () => {
        engine = EphemerisEngine.getInstance();
        await engine.initialize();
        scanner = new TransitScanner(engine);
    });

    test('Finds Jupiter entrance into sidereal Gemini (May 2025)', async () => {
        // Jupiter enters sidereal Gemini (Lahiri) ~May 2025
        const start = DateTime.fromISO('2025-05-01T00:00:00Z');
        const end = DateTime.fromISO('2025-06-10T00:00:00Z');

        const planetId = 5; // Jupiter
        const targetSign = 2; // Gemini (60 deg)

        const ingressTime = await scanner.findIngress(planetId, targetSign, start, end);

        expect(ingressTime).toBeDefined();
        if (ingressTime) {
            console.log(`Jupiter enters sidereal Gemini at: ${ingressTime.toISO()}`);
            expect(ingressTime.month).toBe(5);
            expect(ingressTime.year).toBe(2025);
        }
    });

    test('Finds Saturn entrance into sidereal Pisces (March 2025)', async () => {
        // Saturn enters sidereal Pisces (Lahiri) ~March 2025
        const start = DateTime.fromISO('2025-03-01T00:00:00Z');
        const end = DateTime.fromISO('2025-04-15T00:00:00Z');

        const planetId = 6; // Saturn
        const targetSign = 11; // Pisces

        const ingressTime = await scanner.findIngress(planetId, targetSign, start, end);

        expect(ingressTime).toBeDefined();
        if (ingressTime) {
            console.log(`Saturn enters sidereal Pisces at: ${ingressTime.toISO()}`);
            expect(ingressTime.year).toBe(2025);
        }
    });

    test('Precision: Binary search finds event within 1 minute', async () => {
        const start = DateTime.fromISO('2025-06-08T00:00:00Z');
        const end = DateTime.fromISO('2025-06-09T00:00:00Z');
        
        const check = (t: DateTime) => {
            // Some arbitrary event: Sun hits 50 degrees (sidereal Lahiri)
            const planets = engine.getPlanets(t, { latitude: 0, longitude: 0 }, { ayanamsaOrder: 1 });
            return planets[0].longitude > 50;
        };

        const eventTime = await scanner.findEventTime(start, end, check, { precisionSeconds: 10 });

        expect(eventTime).toBeDefined();
        if (eventTime) {
            // Verify condition flips around this time
            const before = check(eventTime.minus({ seconds: 20 }));
            const after = check(eventTime.plus({ seconds: 20 }));
            expect(before).toBe(false);
            expect(after).toBe(true);
        }
    });

    test('Uses the engine\'s configured ayanamsa, not a hardcoded one', async () => {
        // Saturn enters sidereal Aries in mid-2027. Lahiri and True Chitrapaksha
        // differ by ~0.02 deg, i.e. ~5 hours of Saturn's motion, so the reported
        // ingress must agree with the engine's default ayanamsa to the minute.
        const start = DateTime.fromISO('2027-05-01T00:00:00Z');
        const end = DateTime.fromISO('2027-07-15T00:00:00Z');
        const ingress = await scanner.findIngress(6, 0, start, end);
        expect(ingress).not.toBeNull();

        const signAt = (t: DateTime, opts: { ayanamsaOrder?: number } = {}) => {
            const saturn = engine.getPlanets(t, { latitude: 0, longitude: 0 }, opts).find(p => p.id === 6)!;
            return Math.floor(saturn.longitude / 30);
        };
        expect(signAt(ingress!.minus({ minutes: 2 }))).toBe(11);
        expect(signAt(ingress!.plus({ minutes: 2 }))).toBe(0);
        // Lahiri (order 1) is the larger ayanamsa here, so under it Saturn is still
        // in Pisces hours later; a hardcoded Lahiri scanner would report that time.
        expect(signAt(ingress!.plus({ hours: 2 }), { ayanamsaOrder: 1 })).toBe(11);
    });
});
