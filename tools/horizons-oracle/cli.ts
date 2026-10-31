#!/usr/bin/env node
/**
 * Independent JPL Horizons accuracy oracle for node-jhora.
 *
 *   pnpm horizons-oracle:compare          # offline vs cached fixtures
 *   pnpm horizons-oracle:refresh --live   # refetch fixtures (network)
 *   pnpm horizons-oracle:nightly          # refresh + compare
 */

import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { registerNodeBspLoaderFromCore } from '../../packages/core/node/register.mjs';
import { OBSERVER_SITES } from './config.js';
import { fetchSiteOracle } from './fetch.js';
import { assertFixtureBudget, FIXTURE_DIR, readFixture, writeFixture } from './fixture-io.js';

const live = process.argv.includes('--live') || process.env.HORIZONS_ORACLE_LIVE === '1';

async function cmdRefresh(): Promise<void> {
    if (!live) {
        console.error('Refetch requires --live or HORIZONS_ORACLE_LIVE=1');
        process.exit(1);
    }
    mkdirSync(FIXTURE_DIR, { recursive: true });
    for (const site of OBSERVER_SITES) {
        const { rows, meta } = await fetchSiteOracle(site);
        writeFixture(site, meta, rows);
        console.log(`Wrote ${site.id}: ${rows.length} rows (ephemeris ${meta.ephemeris})`);
    }
    assertFixtureBudget();
}

async function cmdCompare(): Promise<void> {
    const { compareFixture, formatMaxErrorTable, maxErrorTable } = await import('./compare.js');
    const { EphemerisEngine } = await import('../../packages/core/dist/index.js');
    assertFixtureBudget();
    await registerNodeBspLoaderFromCore();
    const engine = EphemerisEngine.getInstance();
    await engine.initialize();

    const allResiduals = [];
    for (const site of OBSERVER_SITES) {
        const fixture = readFixture(site.id);
        allResiduals.push(...compareFixture(engine, fixture, site));
    }
    const table = maxErrorTable(allResiduals);
    const markdown = formatMaxErrorTable(table);
    console.log(markdown);
}

async function main(): Promise<void> {
    const cmd = process.argv[2] ?? 'compare';
    if (cmd === 'refresh') await cmdRefresh();
    else if (cmd === 'compare') await cmdCompare();
    else {
        console.error(`Usage: horizons-oracle cli.ts <refresh|compare> [--live]`);
        process.exit(1);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
