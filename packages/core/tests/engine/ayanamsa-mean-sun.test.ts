import { meanEquinoxLongitudeOnEclipticOf } from '../../src/engine/ayanamsa.js';

describe('ayanamsa mean March equinox (Meeus ch. 27)', () => {
    test('Yukteshwar mode 7 residual matches documented convention gap', async () => {
        const { EphemerisEngine } = await import('../../src/engine/ephemeris.js');
        const { getAyanamsa } = await import('../../src/engine/ayanamsa.js');
        const { readFileSync } = await import('node:fs');
        const kernel = readFileSync(new URL('../../../ephe/de440s.bsp', import.meta.url));
        await EphemerisEngine.getInstance().initialize({ kernel: new Uint8Array(kernel) });
        const fixture = JSON.parse(
            readFileSync(
                new URL('../fixtures/ayanamsa_sidm_parity_pins.json', import.meta.url),
                'utf8',
            ),
        );
        const pins = fixture.modern['7'];
        let sum = 0;
        let n = 0;
        for (const [jd, exp] of Object.entries(pins)) {
            let d = (getAyanamsa(7, Number(jd), 'apparent', 'modern') - exp) % 360;
            if (d > 180) d -= 360;
            if (d < -180) d += 360;
            sum += d * 3600;
            n++;
        }
        expect(sum / n).toBeCloseTo(-329.36, 1);
    });
});
