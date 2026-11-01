import {
    canonicalSerialize,
    formatCanonicalNumber,
    hashCanonicalSerialize,
} from '../src/canonical-serialize.js';

describe('formatCanonicalNumber', () => {
    test('integers and negative zero', () => {
        expect(formatCanonicalNumber(0)).toBe('0');
        expect(formatCanonicalNumber(-0)).toBe('-0');
        expect(formatCanonicalNumber(42)).toBe('42');
        expect(formatCanonicalNumber(-1998)).toBe('-1998');
    });

    test('decimals drop trailing zeros', () => {
        expect(formatCanonicalNumber(1.5)).toBe('1.5');
        expect(formatCanonicalNumber(1.0)).toBe('1');
        expect(formatCanonicalNumber(1.23)).toBe('1.23');
        expect(formatCanonicalNumber(10.5)).toBe('10.5');
        expect(formatCanonicalNumber(0.0001)).toBe('0.0001');
    });

    test('scientific notation expands deterministically', () => {
        expect(formatCanonicalNumber(1e21)).toBe('1000000000000000000000');
        expect(formatCanonicalNumber(1.23e-4)).toBe('0.000123');
    });

    test('rejects non-finite values', () => {
        expect(() => formatCanonicalNumber(Number.NaN)).toThrow(/non-finite/);
        expect(() => formatCanonicalNumber(Number.POSITIVE_INFINITY)).toThrow(/non-finite/);
    });
});

describe('canonicalSerialize', () => {
    test('sorts object keys and omits undefined', () => {
        const left = { z: 1, a: { d: true, c: [1, { b: 2, a: 1 }] }, m: 'x', u: undefined };
        const right = { a: { c: [1, { a: 1, b: 2 }], d: true }, m: 'x', z: 1 };
        expect(canonicalSerialize(left)).toBe(canonicalSerialize(right));
        expect(canonicalSerialize(left)).toBe(
            '{"a":{"c":[1,{"a":1,"b":2}],"d":true},"m":"x","z":1}',
        );
    });

    test('uses fixed number formatting', () => {
        expect(canonicalSerialize({ lon: 229.5 })).toBe('{"lon":229.5}');
        expect(canonicalSerialize({ lon: 229 })).toBe('{"lon":229}');
    });

    test('hash is stable for the same value', () => {
        const value = { settingsHash: 'abc', n: 3.141592653589793 };
        expect(hashCanonicalSerialize(value)).toBe(
            hashCanonicalSerialize({ n: 3.141592653589793, settingsHash: 'abc' }),
        );
        expect(hashCanonicalSerialize(value)).toMatch(/^[a-f0-9]{64}$/);
    });
});
