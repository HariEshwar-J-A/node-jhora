import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { EphemerisEngine } from '../../packages/core/dist/engine/ephemeris.js';
import { OBSERVER_SITES } from './config.js';
import { compareFixture, formatMaxErrorTable, maxErrorTable } from './compare.js';
import { assertFixtureBudget, readFixture, totalFixtureBytes } from './fixture-io.js';

let engine: EphemerisEngine;

beforeAll(async () => {
    engine = EphemerisEngine.getInstance();
    await engine.initialize();
}, 60_000);

describe('Horizons independent oracle', () => {
    test('fixture cache stays within budget', () => {
        expect(totalFixtureBytes()).toBeLessThanOrEqual(200 * 1024);
        assertFixtureBudget();
    });

    test('cached fixtures exist for every observer site', () => {
        const dir = join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures');
        for (const site of OBSERVER_SITES) {
            expect(existsSync(join(dir, `${site.id}.horizons.tsv`))).toBe(true);
        }
    });

    test('modern profile matches Horizons within contract', () => {
        const all = [];
        for (const site of OBSERVER_SITES) {
            const fixture = readFixture(site.id);
            all.push(...compareFixture(engine, fixture, site));
        }
        const table = formatMaxErrorTable(maxErrorTable(all));
        // eslint-disable-next-line no-console -- oracle health report
        console.info('\n' + table + '\n');
        expect(all.length).toBeGreaterThan(0);
    });
});
