#!/usr/bin/env node
/**
 * Regenerate packages/core/tests/fixtures/horizons_golden.ts from JPL Horizons.
 *
 *   pnpm horizons:refresh
 *   pnpm horizons:refresh --check   # fail if fixture would change
 */

import { writeFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchHorizonsFixture } from './horizons/fetch.js';
import { formatHorizonsGoldenTs } from './horizons/format.js';

const fixturePath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../packages/core/tests/fixtures/horizons_golden.ts',
);

async function main(): Promise<void> {
    const checkOnly = process.argv.includes('--check');
    const { epochs, provenance } = await fetchHorizonsFixture();
    const text = formatHorizonsGoldenTs(epochs, provenance);
    const normalized = text.endsWith('\n') ? text : `${text}\n`;

    if (checkOnly) {
        const existing = readFileSync(fixturePath, 'utf8');
        if (existing !== normalized) {
            console.error(`horizons_golden.ts is out of date; run pnpm horizons:refresh`);
            process.exit(1);
        }
        console.log('horizons_golden.ts matches Horizons oracle');
        return;
    }

    writeFileSync(fixturePath, normalized, 'utf8');
    console.log(
        `Wrote ${fixturePath} (${epochs.length} epochs, ephemeris ${provenance.ephemeris})`,
    );
    console.log('Run: pnpm --filter @node-jhora/testkit generate');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
