import { describe, expect, test } from '@jest/globals';

import { isRegression, median, p50, p99 } from '../src/stats.js';

describe('median', () => {
    test('odd count', () => {
        expect(median([3, 1, 2])).toBe(2);
    });

    test('even count', () => {
        expect(median([4, 1, 3, 2])).toBe(2.5);
    });
});

describe('percentiles', () => {
    test('p50 matches median for nine samples', () => {
        const s = [10, 11, 12, 13, 14, 15, 16, 17, 18];
        expect(p50(s)).toBe(14);
    });

    test('p99 is at high end', () => {
        const s = Array.from({ length: 9 }, (_, i) => i + 1);
        expect(p99(s)).toBeGreaterThanOrEqual(8);
    });
});

describe('isRegression', () => {
    test('allows up to tolerance', () => {
        expect(isRegression(100, 114, 0.15)).toBe(false);
        expect(isRegression(100, 116, 0.15)).toBe(true);
    });

    test('fails a deliberate 20% slowdown at 15% gate', () => {
        expect(isRegression(100, 120, 0.15)).toBe(true);
    });
});
