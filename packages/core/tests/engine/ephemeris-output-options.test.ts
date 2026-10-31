import { DateTime } from 'luxon';

import { EphemerisEngine } from '../../src/engine/ephemeris.js';

describe('getPlanets observationCenter and coordinateOutput', () => {
    const engine = EphemerisEngine.getInstance();

    beforeAll(async () => {
        await engine.initialize();
    });

    test('heliocentric Sun sits at origin', () => {
        const dt = DateTime.fromISO('2000-01-01T12:00:00Z');
        const helio = engine.getPlanets(dt, undefined, {
            zodiac: 'tropical',
            observationCenter: 'heliocentric',
        });
        const sun = helio.find((p) => p.name === 'Sun')!;
        expect(sun.longitude).toBeCloseTo(0, 5);
        expect(sun.distance).toBeCloseTo(0, 5);
        const moon = helio.find((p) => p.name === 'Moon')!;
        expect(moon.distance).toBeGreaterThan(0.001);
    });

    test('equatorial output adds rightAscension', () => {
        const dt = DateTime.fromISO('2000-06-21T12:00:00Z');
        const eq = engine.getPlanets(dt, undefined, {
            zodiac: 'tropical',
            coordinateOutput: 'equatorial',
        });
        const sun = eq.find((p) => p.name === 'Sun')!;
        expect(sun.rightAscension).toBeDefined();
        expect(sun.declination).toBeDefined();
        expect(Math.abs(sun.declination)).toBeLessThan(24);
    });
});
