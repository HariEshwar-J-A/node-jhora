import { brent } from '../../src/astro/solver.js';

const TOL = 1e-9;
const MAX_ITER = 80;

function expectRoot(
    f: (x: number) => number,
    a: number,
    b: number,
    expected: number,
    maxIter = MAX_ITER,
): void {
    const r = brent(f, a, b, TOL, maxIter);
    expect(r).not.toBeNull();
    expect(Math.abs(r!.root - expected)).toBeLessThanOrEqual(TOL);
    expect(r!.iterations).toBeLessThanOrEqual(maxIter);
}

describe('brent (Brent 1973 zero / zeroin)', () => {
    test('returns null without a sign change', () => {
        expect(brent((x) => x * x + 1, 0, 1)).toBeNull();
    });

    test('e^x − 10^6 on [0, 20]', () => {
        const f = (x: number) => Math.exp(x) - 1e6;
        expectRoot(f, 0, 20, Math.log(1e6), 40);
    });

    test('kinked piecewise-linear on [0, 1]', () => {
        const f = (x: number) => (x < 0.5 ? x - 0.5 : 2 * x - 1);
        expectRoot(f, 0, 1, 0.5, 30);
    });

    test('tanh(50(x − 0.123)) on [−1, 2]', () => {
        const f = (x: number) => Math.tanh(50 * (x - 0.123));
        expectRoot(f, -1, 2, 0.123);
    });

    test('x³ − 2x − 5 on [2, 3]', () => {
        const f = (x: number) => x ** 3 - 2 * x - 5;
        expectRoot(f, 2, 3, 2.0945514815);
    });

    test('sin on [3, 3.3]', () => {
        const f = (x: number) => Math.sin(x);
        expectRoot(f, 3, 3.3, Math.PI);
    });
});
