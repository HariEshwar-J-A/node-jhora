#!/usr/bin/env node
/**
 * check:pack — gate on what each publishable package would put in its npm
 * tarball. Runs `npm pack --dry-run --json --ignore-scripts` per non-private
 * package and fails on:
 *   - unpacked size over budget (code packages 1 MB, data packages 40 MB)
 *   - forbidden files: source maps, tsbuildinfo, tests, fixtures, coverage,
 *     .partial downloads, and ephemeris data (.bsp/.njce) outside the
 *     data package allowlist
 *   - missing README.md, or missing LICENSE (code) / NOTICE.md (data)
 *   - publint errors or warnings, and attw problems (esm-only profile)
 *
 * Usage: node scripts/check-pack.mjs [--no-lint] [--json]
 * Requires a built workspace (`pnpm build`). See ADR 0006.
 */

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { execCliSync } from '../tools/spawn-cli.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = new Set(process.argv.slice(2));
const lint = !args.has('--no-lint');

const MB = 1_000_000;
const CODE_BUDGET = 1 * MB;
/** Data-only packages: may ship pinned ephemeris files. */
const DATA_PACKAGES = new Map([
    ['@node-jhora/ephe', { budget: 40 * MB, allow: /^de440s\.bsp$/ }],
    ['@node-jhora/eop', { budget: 40 * MB, allow: /^eop\.bin$/ }],
]);

const FORBIDDEN = [
    [/\.map$/, 'source map'],
    [/\.tsbuildinfo$/, 'tsbuildinfo'],
    [
        /(^|\/)(tests?|__tests__|__mocks__|fixtures|coverage|\.cache)\//,
        'test/fixture/cache directory',
    ],
    [/\.(test|spec)\.[cm]?[jt]sx?$/, 'test file'],
    [/\.partial$/, 'partial download'],
    [/\.(bsp|njce)$/, 'ephemeris data'],
    [/(^|\/)\.env/, 'env file'],
];

function run(cmd, cmdArgs, cwd) {
    if (cmd === 'npm') {
        return execCliSync('npm', cmdArgs, { cwd, maxBuffer: 64 * 1024 * 1024 });
    }
    return execFileSync(cmd, cmdArgs, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

const bin = (name) => join(root, 'node_modules', '.bin', name);

const results = [];
let failed = false;

for (const dir of readdirSync(join(root, 'packages')).sort()) {
    const pkgDir = join(root, 'packages', dir);
    let pkg;
    try {
        pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));
    } catch {
        continue;
    }
    if (pkg.private) continue;

    const data = DATA_PACKAGES.get(pkg.name);
    const [info] = JSON.parse(
        run('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], pkgDir),
    );
    const paths = info.files.map((f) => f.path);
    const problems = [];

    const budget = data?.budget ?? CODE_BUDGET;
    if (info.unpackedSize > budget) {
        problems.push(
            `unpacked ${(info.unpackedSize / MB).toFixed(2)} MB exceeds budget ${(budget / MB).toFixed(0)} MB`,
        );
    }
    for (const path of paths) {
        if (data?.allow.test(path)) continue;
        const hit = FORBIDDEN.find(([re]) => re.test(path));
        if (hit) problems.push(`forbidden ${hit[1]}: ${path}`);
    }
    if (!paths.includes('README.md')) problems.push('missing README.md');
    const legal = data
        ? 'NOTICE.md'
        : pkg.license?.startsWith('LicenseRef-NASA')
          ? 'NOTICE.md'
          : 'LICENSE';
    if (!paths.includes(legal)) problems.push(`missing ${legal}`);
    if (!pkg.repository?.url?.includes('HariEshwar-J-A/node-jhora'))
        problems.push('repository.url must point at HariEshwar-J-A/node-jhora');
    if (pkg.scripts?.postinstall || pkg.scripts?.install || pkg.scripts?.preinstall) {
        problems.push('install lifecycle scripts are not allowed in published packages');
    }

    if (lint) {
        try {
            run(bin('publint'), ['run', pkgDir, '--strict'], root);
        } catch (err) {
            problems.push(`publint:\n${(err.stdout || err.stderr || err.message).trim()}`);
        }
        if (pkg.exports || pkg.main) {
            // Asset subpaths (e.g. "./de440s.bsp") have no types by design.
            const assets = Object.entries(typeof pkg.exports === 'object' ? pkg.exports : {})
                .filter(
                    ([, target]) =>
                        typeof target === 'string' && !/\.(m?js|cjs|json)$/.test(target),
                )
                .map(([key]) => key);
            const exclude = assets.length ? ['--exclude-entrypoints', ...assets] : [];
            try {
                run(
                    bin('attw'),
                    [
                        '--pack',
                        pkgDir,
                        '--profile',
                        'esm-only',
                        '--format',
                        'table-flipped',
                        ...exclude,
                    ],
                    root,
                );
            } catch (err) {
                problems.push(`attw:\n${(err.stdout || err.stderr || err.message).trim()}`);
            }
        }
    }

    if (problems.length) failed = true;
    results.push({
        name: pkg.name,
        version: pkg.version,
        packedBytes: info.size,
        unpackedBytes: info.unpackedSize,
        files: info.entryCount,
        problems,
    });
}

if (args.has('--json')) {
    console.log(JSON.stringify(results, null, 2));
} else {
    const pad = (s, n) => String(s).padEnd(n);
    console.log(`${pad('package', 26)}${pad('packed', 11)}${pad('unpacked', 11)}files  status`);
    for (const r of results) {
        console.log(
            `${pad(r.name, 26)}${pad(`${(r.packedBytes / MB).toFixed(3)} MB`, 11)}${pad(`${(r.unpackedBytes / MB).toFixed(3)} MB`, 11)}` +
                `${pad(r.files, 7)}${r.problems.length ? 'FAIL' : 'ok'}`,
        );
        for (const p of r.problems) console.log(`    - ${p.replace(/\n/g, '\n      ')}`);
    }
}
if (failed) {
    console.error(
        '\ncheck:pack failed. See ADR docs/decisions/0006-npm-packaging-and-ephemeris-data-distribution.md.',
    );
    process.exit(1);
}
