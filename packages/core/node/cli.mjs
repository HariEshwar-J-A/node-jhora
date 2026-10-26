#!/usr/bin/env node
/**
 * node-jhora-ephe — inspect, prefetch, and verify ephemeris data.
 *
 *   node-jhora-ephe where
 *   node-jhora-ephe prefetch de440s [--cache-dir DIR]
 *   node-jhora-ephe prefetch de431 --from YEAR --to YEAR (--base-url URL | --cdn) [--cache-dir DIR]
 *   node-jhora-ephe verify [--dir DIR] [--cache-dir DIR]
 *
 * Years are astronomical (0 = 1 BCE, -2999 = 3000 BCE). Every file is checked
 * against the SHA-256 manifest shipped in @node-jhora/core. Exit code 0 on
 * success, 1 on any failure, 2 on bad usage.
 */

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import {
    DE440S_FILE,
    defaultCacheDir,
    downloadDe440s,
    findLocalDe440s,
    njceCacheDir,
    prefetchChunks,
    sha256File,
    verifyFile,
} from './ephemeris.mjs';

const USAGE = `usage:
  node-jhora-ephe where
  node-jhora-ephe prefetch de440s [--cache-dir DIR]
  node-jhora-ephe prefetch de431 --from YEAR --to YEAR (--base-url URL | --cdn) [--cache-dir DIR]
  node-jhora-ephe verify [--dir DIR] [--cache-dir DIR]`;

function usage(message) {
    if (message) console.error(`node-jhora-ephe: ${message}`);
    console.error(USAGE);
    process.exit(2);
}

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
        'cache-dir': { type: 'string' },
        'base-url': { type: 'string' },
        cdn: { type: 'boolean', default: false },
        from: { type: 'string' },
        to: { type: 'string' },
        dir: { type: 'string', multiple: true },
        help: { type: 'boolean', short: 'h', default: false },
    },
});

if (values.help) {
    console.log(USAGE);
    process.exit(0);
}

const cacheDir = values['cache-dir'] ?? defaultCacheDir();
const [command, target] = positionals;

async function main() {
    if (command === 'where') {
        const local = findLocalDe440s({ cacheDir });
        console.log(`cache: ${cacheDir}`);
        console.log(`de440s: ${local ? `${local.path} (${local.tier})` : 'not found'}`);
        return 0;
    }

    if (command === 'prefetch' && target === 'de440s') {
        const path = await downloadDe440s({ cacheDir, log: (m) => console.error(m) });
        console.log(`de440s.bsp verified at ${path}`);
        return 0;
    }

    if (command === 'prefetch' && target === 'de431') {
        const fromYear = Number(values.from);
        const toYear = Number(values.to);
        if (!Number.isInteger(fromYear) || !Number.isInteger(toYear))
            usage('--from and --to must be integer years');
        if (!values['base-url'] && !values.cdn)
            usage('pass --base-url URL (self-hosted chunks) or --cdn');
        const results = await prefetchChunks({
            fromYear,
            toYear,
            cacheDir,
            baseUrl: values['base-url'],
            cdn: values.cdn,
            dirs: values.dir,
        });
        const missing = results.filter((r) => !r.ok);
        const total = results.reduce((n, r) => n + r.bytes, 0);
        console.log(
            `${results.length - missing.length}/${results.length} chunks verified (${(total / 1e6).toFixed(1)} MB)`,
        );
        for (const r of missing)
            console.error(`missing g${r.groupId}-c${r.century}${r.error ? `: ${r.error}` : ''}`);
        return missing.length ? 1 : 0;
    }

    if (command === 'verify') {
        const m = await import('../dist/ephemeris-data/index.js');
        let checked = 0;
        let failed = 0;
        const local = findLocalDe440s({ cacheDir });
        if (local) {
            try {
                verifyFile(local.path, DE440S_FILE, { full: true });
                checked++;
            } catch (err) {
                failed++;
                console.error(err.message);
            }
        }
        const dirs = [...(values.dir ?? []), njceCacheDir(cacheDir, m.NJCE_DATA_VERSION)];
        for (const dir of dirs) {
            if (!existsSync(dir)) continue;
            for (const name of readdirSync(dir)) {
                const match = /^g([01])-c(-?\d+)\.njce$/.exec(name);
                if (!match) continue;
                const entry = m.njceChunkEntry({
                    groupId: Number(match[1]),
                    century: Number(match[2]),
                });
                const path = join(dir, name);
                if (!entry || sha256File(path) !== entry.sha256) {
                    failed++;
                    console.error(`${path}: does not match the DE431 manifest`);
                } else {
                    checked++;
                }
            }
        }
        console.log(`${checked} file(s) verified, ${failed} failed`);
        return failed ? 1 : 0;
    }

    usage(command ? `unknown command: ${positionals.join(' ')}` : undefined);
    return 2;
}

main().then(
    (code) => process.exit(code),
    (err) => {
        console.error(`node-jhora-ephe: ${err.message}`);
        process.exit(1);
    },
);
