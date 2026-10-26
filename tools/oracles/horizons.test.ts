import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    parseEphemerisLabel,
    parseHorizonsObserverTable,
    horizonsQueryUrlTemplate,
} from './horizons/fetch.js';
import { formatAngle, formatHorizonsGoldenTs } from './horizons/format.js';
import { jdFromUtc } from './horizons/julday.js';
import * as horizons from '../../packages/core/tests/fixtures/horizons_golden.js';

const fixturePath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../packages/core/tests/fixtures/horizons_golden.ts',
);

describe('Horizons oracle formatting', () => {
    it('formats angles with fixed precision', () => {
        expect(formatAngle(280.1532941)).toBe('280.1532941');
        expect(formatAngle(-0.9254021)).toBe('-0.9254021');
    });

    it('parses observer tables and ephemeris label', () => {
        const sample = `Target body name: Sun (10)                        {source: DE441}
$$SOE
 1900-Jan-01 00:00:00.000     280.1532941   0.0000648
 1970-Jul-08 20:10:00.000     106.2314146  -0.0000881
$$EOE`;
        const rows = parseHorizonsObserverTable(sample);
        expect(rows).toHaveLength(2);
        expect(rows[0].lon).toBeCloseTo(280.1532941, 10);
        expect(parseEphemerisLabel(sample)).toBe('DE441');
    });

    it('builds a stable query URL template', () => {
        const url = horizonsQueryUrlTemplate();
        expect(url).toContain('horizons.api');
        expect(decodeURIComponent(url)).toContain('{COMMAND}');
        expect(decodeURIComponent(url)).toContain('{TLIST}');
        expect(url).toMatch(/CENTER=500(%40|@)399/);
    });

    it('is idempotent when re-formatting the checked-in fixture epochs', () => {
        const text = formatHorizonsGoldenTs(horizons.HORIZONS_EPOCHS, horizons.HORIZONS_PROVENANCE);
        const again = formatHorizonsGoldenTs(horizons.HORIZONS_EPOCHS, horizons.HORIZONS_PROVENANCE);
        expect(text).toBe(again);
        expect(text).toBe(readFileSync(fixturePath, 'utf8'));
    });

    it('computes JD consistent with fixture for sample epochs', () => {
        for (const epoch of horizons.HORIZONS_EPOCHS) {
            const jd = jdFromUtc(epoch.utc);
            expect(Math.abs(jd - epoch.jd)).toBeLessThan(1e-6);
        }
    });
});
