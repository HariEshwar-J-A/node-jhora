#!/usr/bin/env node
/**
 * Stage the DE431 long-range data packages for a later `npm publish`.
 *
 *   node packages/ephe-long/scripts/stage-data-packages.mjs \
 *     [--chunks DIR] [--out DIR] [--only NAME] [--pack-dry-run]
 *
 * Builds one directory per 500-year package (@node-jhora/ephe-de431-p1500,
 * @node-jhora/ephe-de431-m3000, …): ten .njce files (five centuries × two
 * body groups), package.json, README.md and NOTICE.md. Every chunk is checked
 * against the SHA-256 manifest in @node-jhora/core before it is staged.
 * With --pack-dry-run it runs `npm pack --dry-run --json` in each directory
 * and prints sizes. This script never publishes; see ADR 0006 for the
 * publish setup.
 *
 * Needs a built @node-jhora/core (pnpm --filter @node-jhora/core build).
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
    copyFileSync,
    existsSync,
    linkSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const here = dirname(fileURLToPath(import.meta.url));
const m = await import('../../core/dist/ephemeris-data/index.js');

const { values } = parseArgs({
    options: {
        chunks: { type: 'string', default: process.env.NJCE_DIR ?? join(here, '../dist') },
        out: { type: 'string', default: join(here, '../../../.release/ephe-de431') },
        only: { type: 'string', multiple: true },
        'pack-dry-run': { type: 'boolean', default: false },
    },
});

const REPO = 'git+https://github.com/HariEshwar-J-A/node-jhora.git';

function yearLabel(y) {
    return y <= 0 ? `${1 - y} BCE` : `${y} CE`;
}

/** Group manifest entries by package name. */
const packages = new Map();
for (const entry of m.njceChunkEntries()) {
    const name = m.njcePackageName(entry.century);
    if (!packages.has(name))
        packages.set(name, { start: m.njcePackageStartYear(entry.century), entries: [] });
    packages.get(name).entries.push(entry);
}

function stage(name, { start, entries }) {
    const end = start + m.NJCE_PACKAGE_SPAN_CENTURIES * 100 - 1;
    const dir = join(values.out, name.replace('@node-jhora/', ''));
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    let bytes = 0;
    for (const entry of entries) {
        const src = join(values.chunks, entry.file);
        if (!existsSync(src)) throw new Error(`${name}: missing ${src}`);
        const buf = readFileSync(src);
        const digest = createHash('sha256').update(buf).digest('hex');
        if (buf.length !== entry.bytes || digest !== entry.sha256) {
            throw new Error(
                `${name}: ${entry.file} does not match the manifest (sha256 ${digest})`,
            );
        }
        try {
            linkSync(src, join(dir, entry.file));
        } catch {
            copyFileSync(src, join(dir, entry.file));
        }
        bytes += buf.length;
    }
    const files = entries.map((e) => e.file);
    const pkg = {
        name,
        version: m.NJCE_DATA_VERSION,
        description: `JPL DE431 ephemeris chunks for astronomical years ${start}..${end} (${yearLabel(start)} to ${yearLabel(end)}) for node-jhora`,
        license: 'LicenseRef-NASA-Open-Government',
        files: [...files, 'NOTICE.md', 'README.md'],
        keywords: ['jpl', 'de431', 'ephemeris', 'node-jhora'],
        repository: { type: 'git', url: REPO, directory: 'packages/ephe-long' },
        publishConfig: { access: 'public' },
    };
    writeFileSync(join(dir, 'package.json'), `${JSON.stringify(pkg, null, 4)}\n`);
    writeFileSync(
        join(dir, 'README.md'),
        `# ${name}\n\nData only. Long-range JPL DE431 chunks in node-jhora's NJCE format for astronomical years ` +
            `${start}..${end} (${yearLabel(start)} to ${yearLabel(end)}).\n\n` +
            'Install it next to `@node-jhora/core`; the Node chunk loader finds it automatically ' +
            '(`registerNodeChunkStore` from `@node-jhora/core/node/ephemeris`). ' +
            'Every chunk is checked against the SHA-256 manifest in `@node-jhora/core` before use.\n',
    );
    const rows = entries.map((e) => `| \`${e.file}\` | ${e.bytes} | \`${e.sha256}\` |`).join('\n');
    writeFileSync(
        join(dir, 'NOTICE.md'),
        `# Data provenance — ${name}\n\n` +
            `Chebyshev coefficients copied verbatim from JPL DE431 (\`${m.DE431_SOURCE.file}\`, ` +
            `${m.DE431_SOURCE.bytes} bytes, ${m.DE431_SOURCE.url}) by ` +
            '`packages/ephe-long/scripts/build-chunks.mjs`; layout in `packages/ephe-long/FORMAT.md`. ' +
            'The build is deterministic: rebuilding from the same kernel gives byte-identical files.\n\n' +
            'Citation: W. M. Folkner, J. G. Williams, D. H. Boggs, R. S. Park, P. Kuchynka, ' +
            '"The Planetary and Lunar Ephemerides DE430 and DE431", IPN Progress Report 42-196 (2014).\n\n' +
            `| file | bytes | sha256 |\n|---|---|---|\n${rows}\n`,
    );
    return { name, dir, bytes, files: files.length };
}

const selected = [...packages].filter(([name]) => !values.only || values.only.includes(name));
if (selected.length === 0) {
    console.error('no packages selected');
    process.exit(2);
}
const staged = selected.map(([name, info]) => stage(name, info));
let largest = 0;
for (const s of staged) {
    let line = `${s.name.padEnd(34)} ${String(s.files).padStart(3)} files ${(s.bytes / 1e6).toFixed(1).padStart(6)} MB`;
    if (values['pack-dry-run']) {
        const [info] = JSON.parse(
            execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
                cwd: s.dir,
                encoding: 'utf8',
            }),
        );
        largest = Math.max(largest, info.size);
        line += `  packed ${(info.size / 1e6).toFixed(1).padStart(6)} MB`;
    }
    console.log(line);
}
console.log(`${staged.length} package(s) staged in ${values.out}`);
if (largest) console.log(`largest packed tarball: ${(largest / 1e6).toFixed(1)} MB`);
