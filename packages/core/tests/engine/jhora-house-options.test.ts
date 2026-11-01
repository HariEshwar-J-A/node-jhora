import { DateTime } from 'luxon';

import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { applyCuspsInMiddle, ninePadaEqualCusps } from '../../src/engine/house-systems.js';
import { calculateHouseCusps } from '../../src/vedic/houses.js';

describe('JHora house options', () => {
    beforeAll(async () => {
        await EphemerisEngine.getInstance().initialize();
    });

    const date = DateTime.fromObject(
        { year: 2000, month: 1, day: 1, hour: 12, minute: 0, second: 0 },
        {
            zone: 'utc',
        },
    );
    const lat = 51.476852;
    const lon = -0.0005;

    test('cuspsInMiddle shifts equal cusps by 15°', () => {
        const plain = calculateHouseCusps(date, lat, lon, 'Equal', undefined, 27, 0, {
            houseSystemId: 'equal',
            cuspsInMiddle: false,
        });
        const middle = calculateHouseCusps(date, lat, lon, 'Equal', undefined, 27, 0, {
            houseSystemId: 'equal',
            cuspsInMiddle: true,
        });
        const shift = ((middle.cusps[0] - plain.cusps[0] + 540) % 360) - 180;
        expect(shift).toBeCloseTo(-15, 5);
        expect(middle.ascendant).toBeCloseTo(plain.ascendant, 8);
    });

    test('nine-pada equal uses 40° steps from sign start', () => {
        const res = calculateHouseCusps(date, lat, lon, 'NinePadaEqual', undefined, 27, 0, {
            houseSystemId: 'nine_pada_equal',
        });
        const signStart = Math.floor(res.ascendant / 30) * 30;
        expect(res.cusps[0]).toBeCloseTo(signStart, 8);
        expect((res.cusps[1] - res.cusps[0] + 360) % 360).toBeCloseTo(40, 8);
    });

    test('applyCuspsInMiddle matches engine flag', () => {
        const cusps = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
        const shifted = applyCuspsInMiddle(cusps, 5);
        expect(shifted[0]).toBe(345);
    });

    test('ninePadaEqualCusps helper', () => {
        const c = ninePadaEqualCusps(25);
        expect(c[0]).toBe(0);
        expect(c[1]).toBe(40);
    });
});
