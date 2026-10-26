import { describe, expect, test } from '@jest/globals';

import { sphericalRatesDegPerDay, unitVectorDerivative } from '../../src/engine/kinematics.js';

describe('kinematics', () => {
    test('unitVectorDerivative is perpendicular to the unit vector', () => {
        const r: [number, number, number] = [1, 2, 3];
        const v: [number, number, number] = [0.1, -0.2, 0.05];
        const du = unitVectorDerivative(r, v);
        const u = [r[0] / Math.hypot(...r), r[1] / Math.hypot(...r), r[2] / Math.hypot(...r)];
        const dot = du[0] * u[0] + du[1] * u[1] + du[2] * u[2];
        expect(Math.abs(dot)).toBeLessThan(1e-12);
    });

    test('spherical longitude rate on circular motion in the ecliptic plane', () => {
        const pos: [number, number, number] = [1, 0, 0];
        const vel: [number, number, number] = [0, Math.PI / 180, 0]; // 1°/day on unit circle
        const rates = sphericalRatesDegPerDay(pos, vel);
        expect(rates.lon).toBeCloseTo(1, 6);
        expect(rates.lat).toBeCloseTo(0, 9);
    });
});
