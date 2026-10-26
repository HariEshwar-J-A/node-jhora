import { describe, expect, test } from '@jest/globals';

import { isRegression, median } from '../src/stats.js';

describe('median', () => {
    test('odd count', () => {
        expect(median([3, 1, 2])).toBe(2);
    });

    test('even count', () => {
        expect(median([4, 1, 3, 2])).toBe(2.5);
    });
});

describe('isRegression', () => {
    test('allows up to tolerance', () => {
        expect(isRegression(100, 114, 0.15)).toBe(false);
        expect(isRegression(100, 116, 0.15)).toBe(true);
    });
});
