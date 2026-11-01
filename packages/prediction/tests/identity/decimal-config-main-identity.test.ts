/**
 * Hex/SHA identity vs `origin/main` (de758a3) for Decimal-sensitive dashas and shadbala time.
 * Fixture captured once from main before removing global Decimal.set (see fixture header).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { EphemerisEngine } from '@node-jhora/core';

import { BIRTH_CASES, computeAllDigests } from './compute-decimal-config-digest.js';

const FIXTURE_PATH = fileURLToPath(
    new URL('../fixtures/decimal-config-main-digest.json', import.meta.url),
);

describe('Decimal config identity vs main fixture', () => {
    beforeAll(async () => {
        await EphemerisEngine.getInstance().initialize();
    });

    test('extended dashas and shadbala time match main digests (21 births)', async () => {
        const engine = EphemerisEngine.getInstance();
        const computed = await computeAllDigests(engine);

        if (process.env.WRITE_MAIN_DECIMAL_FIXTURE === '1') {
            const payload = {
                capturedFrom:
                    'origin/main @ de758a3 (global Decimal.set via @node-jhora/core load); kalachakra digested as UTC epoch ms',
                serializationNote:
                    'Kalachakra antardasha toISO() uses the process local zone; identity hashes UTC instants only.',
                cases: computed,
            };
            writeFileSync(FIXTURE_PATH, `${JSON.stringify(payload, null, 2)}\n`);
            return;
        }

        expect(existsSync(FIXTURE_PATH)).toBe(true);
        const fixture = JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as {
            cases: Record<string, Record<string, string>>;
        };

        for (const c of BIRTH_CASES) {
            expect(computed[c.id]).toEqual(fixture.cases[c.id]);
        }
    });
});
