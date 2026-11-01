import {
    AstroSeriesCache,
    ASTRO_SERIES_NUTATION_IAU2000A,
    withAstroSeriesCache,
} from '../../src/engine/astro-series-cache.js';

describe('AstroSeriesCache (instance memo)', () => {
    test('returns correct values when FIFO evicts past cap', () => {
        const cache = new AstroSeriesCache(2);
        let calls = 0;
        const compute = (T: number) => {
            calls++;
            return { dpsi: T, deps: T * 2 };
        };

        withAstroSeriesCache(cache, () => {
            const a = cache.get(ASTRO_SERIES_NUTATION_IAU2000A, 0.1, () => compute(0.1));
            const b = cache.get(ASTRO_SERIES_NUTATION_IAU2000A, 0.2, () => compute(0.2));
            const c = cache.get(ASTRO_SERIES_NUTATION_IAU2000A, 0.3, () => compute(0.3));
            expect(c.dpsi).toBe(0.3);
            expect(c.deps).toBe(0.6);
            expect(a.dpsi).toBe(0.1);
            expect(b.dpsi).toBe(0.2);
        });
        expect(calls).toBe(3);
    });

    test('nested withAstroSeriesCache restores outer cache', () => {
        const outer = new AstroSeriesCache(64);
        const inner = new AstroSeriesCache(64);
        let outerHits = 0;
        withAstroSeriesCache(outer, () => {
            outer.get(ASTRO_SERIES_NUTATION_IAU2000A, 0, () => {
                outerHits++;
                return { dpsi: 1, deps: 2 };
            });
            withAstroSeriesCache(inner, () => {
                const v = inner.get(ASTRO_SERIES_NUTATION_IAU2000A, 0, () => ({
                    dpsi: 9,
                    deps: 8,
                }));
                expect(v.dpsi).toBe(9);
            });
            const again = outer.get(ASTRO_SERIES_NUTATION_IAU2000A, 0, () => ({
                dpsi: 3,
                deps: 4,
            }));
            expect(again.dpsi).toBe(1);
        });
        expect(outerHits).toBe(1);
    });
});
