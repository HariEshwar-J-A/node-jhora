import { DateTime } from 'luxon';

import { EphemerisEngine } from '../../src/engine/ephemeris.js';

describe('planet daily motion (speed)', () => {
    let engine: EphemerisEngine;

    beforeAll(async () => {
        engine = EphemerisEngine.getInstance();
        await engine.initialize();
    });

    test('Moon speed stays geocentric when topocentric=false', () => {
        const dt = DateTime.utc(2100, 6, 15, 12);
        const loc = { latitude: 13.08, longitude: 80.27 };
        const geo = engine.getPlanets(dt, loc, { topocentric: false });
        const topo = engine.getPlanets(dt, loc, { topocentric: true });
        const moonGeo = geo.find((p) => p.name === 'Moon');
        const moonTopo = topo.find((p) => p.name === 'Moon');
        expect(moonGeo).toBeDefined();
        expect(moonTopo).toBeDefined();
        // Geocentric daily motion ~14°/d; wrongly applying the observer offset to
        // the speed samples inflated this to ~16.6°/d (JHora / DE440s, 2100).
        expect(moonGeo!.speed).toBeGreaterThan(13.5);
        expect(moonGeo!.speed).toBeLessThan(14.8);
        expect(moonGeo!.speed).toBeLessThan(15.5);
        expect(Math.abs(moonGeo!.speed - moonTopo!.speed)).toBeGreaterThan(0.05);
    });
});
