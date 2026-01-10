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

    test('Finds Jupiter entrance into Gemini (May 2025)', async () => {
        // Jupiter enters Gemini on May 14, 2025
        const start = DateTime.fromISO('2025-05-01T00:00:00Z');
        const end = DateTime.fromISO('2025-06-01T00:00:00Z');
        
        const planetId = 5; // Jupiter
        const targetSign = 2; // Gemini (60 deg)

        const ingressTime = await scanner.findIngress(planetId, targetSign, start, end);

        expect(ingressTime).toBeDefined();
        if (ingressTime) {
            console.log(`Jupiter enters Gemini at: ${ingressTime.toISO()}`);
            expect(ingressTime.month).toBe(5);
            expect(ingressTime.day).toBe(14);
            expect(ingressTime.year).toBe(2025);
        }
    });

    test('Finds Saturn entrance into Pisces (March 2025)', async () => {
        // Saturn enters Pisces (330 deg) on March 29, 2025
        const start = DateTime.fromISO('2025-03-01T00:00:00Z');
        const end = DateTime.fromISO('2025-04-01T00:00:00Z');
        
        const planetId = 6; // Saturn
        const targetSign = 11; // Pisces

        const ingressTime = await scanner.findIngress(planetId, targetSign, start, end);

        expect(ingressTime).toBeDefined();
        if (ingressTime) {
            console.log(`Saturn enters Pisces at: ${ingressTime.toISO()}`);
            expect(ingressTime.month).toBe(3);
            expect(ingressTime.day).toBe(29);
            expect(ingressTime.year).toBe(2025);
        }
    });

    test('Precision: Binary search finds event within 1 minute', async () => {
        const start = DateTime.fromISO('2025-06-08T00:00:00Z');
        const end = DateTime.fromISO('2025-06-09T00:00:00Z');
        
        const check = (t: DateTime) => {
            // Some arbitrary event: Sun hits 50 degrees
            const planets = engine.getPlanets(t, { latitude: 0, longitude: 0 }, 1, false);
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
});
