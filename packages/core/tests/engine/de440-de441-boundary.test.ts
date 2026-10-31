/**
 * DE440s vs DE441 kernel boundary — values from tools/measure-de440-de441-boundary.mjs only.
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const fixturePath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../fixtures/de440-de441-boundary.json',
);

function loadFixture():
    | {
          measuredAt: string;
          measuredBy: string;
          de440sBoundaryArcsec: Array<{ jdTdb: number; body: string; deltaArcsec: number }>;
          partStitchArcsec: Array<{ body: string; deltaArcsec: number }>;
      }
    | undefined {
    if (!readFileSync) return undefined;
    try {
        const raw = JSON.parse(readFileSync(fixturePath, 'utf8')) as {
            measuredAt?: string;
            measuredBy?: string;
            de440sBoundaryArcsec?: unknown[];
        };
        if (
            !raw.measuredAt ||
            raw.measuredBy !== 'tools/measure-de440-de441-boundary.mjs' ||
            !Array.isArray(raw.de440sBoundaryArcsec) ||
            raw.de440sBoundaryArcsec.length === 0
        ) {
            return undefined;
        }
        return raw as ReturnType<typeof loadFixture> extends infer T ? NonNullable<T> : never;
    } catch {
        return undefined;
    }
}

const fixture = loadFixture();

const suite = fixture ? describe : describe.skip;

suite('DE440s / DE441 switch boundary (measured BSP fixture)', () => {
    test('fixture provenance is from the measure tool', () => {
        expect(fixture!.measuredBy).toBe('tools/measure-de440-de441-boundary.mjs');
        expect(fixture!.provenance.de440s.md5).toBe('3917ee56769db332790c751e2168843d');
    });

    test('planets at DE440s edges differ by less than 1 mas vs DE441 part kernels', () => {
        for (const row of fixture!.de440sBoundaryArcsec) {
            if (row.body === 'Moon') continue;
            expect(row.deltaArcsec).toBeLessThan(0.001);
        }
    });

    test('Moon at DE440s edges differs by less than 0.001 arcsec vs DE441 (barycentric km)', () => {
        for (const row of fixture!.de440sBoundaryArcsec.filter((r) => r.body === 'Moon')) {
            expect(row.deltaArcsec).toBeLessThan(0.001);
        }
    });

    test('DE441 part-1 vs part-2 stitch at overlap is zero at float64 evaluation', () => {
        for (const row of fixture!.partStitchArcsec) {
            expect(row.deltaArcsec).toBe(0);
        }
    });
});

if (!fixture) {
    test('boundary fixture missing — run tools/measure-de440-de441-boundary.mjs with NAIF BSPs', () => {
        expect(fixture).toBeDefined();
    });
}
