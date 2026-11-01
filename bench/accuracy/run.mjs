#!/usr/bin/env node
/**
 * Orchestrate the cross-library accuracy benchmark.
 *
 *   node bench/accuracy/run.mjs [--quick]
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { allEpochSamples } from './lib/epochs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BENCH_ROOT = __dirname;
const REPO_ROOT = resolve(BENCH_ROOT, '../..');

const quick = process.argv.includes('--quick');

function run(cmd, args, opts = {}) {
    const r = spawnSync(cmd, args, {
        stdio: opts.quiet ? 'ignore' : 'inherit',
        cwd: opts.cwd ?? BENCH_ROOT,
        env: process.env,
    });
    if (r.status !== 0) {
        throw new Error(`${cmd} ${args.join(' ')} failed with ${r.status}`);
    }
}

function pythonBin() {
    const venv = join(BENCH_ROOT, '.venv/bin/python');
    if (existsSync(venv)) return venv;
    return 'python3';
}

function ensurePythonDeps() {
    const pyProbe = spawnSync(pythonBin(), ['-c', 'import skyfield'], { stdio: 'ignore' });
    if (pyProbe.status !== 0) {
        run('python3', ['-m', 'venv', join(BENCH_ROOT, '.venv')]);
        const pip = join(BENCH_ROOT, '.venv/bin/pip');
        run(
            pip,
            [
                'install',
                '-q',
                '-r',
                join(BENCH_ROOT, 'requirements.txt'),
                '--only-binary=:all:',
                'pyswisseph',
            ],
            {
                quiet: true,
            },
        );
        const retry = spawnSync(
            pip,
            ['install', '-q', '-r', join(BENCH_ROOT, 'requirements.txt')],
            {
                stdio: 'ignore',
            },
        );
        if (retry.status !== 0) {
            throw new Error('pip install requirements failed');
        }
    }
}

function main() {
    const epochs = allEpochSamples(quick);
    mkdirSync(join(BENCH_ROOT, 'artifacts'), { recursive: true });
    writeFileSync(join(BENCH_ROOT, 'artifacts/epochs.json'), JSON.stringify(epochs, null, 2));

    console.log('Building ΔT table…');
    run('python3', [join(BENCH_ROOT, 'lib/build_deltat.py')]);

    console.log('Ensuring Python venv…');
    ensurePythonDeps();

    console.log('Installing bench-local npm deps…');
    const npmProbe = spawnSync('npm', ['install'], { cwd: BENCH_ROOT, stdio: 'ignore' });
    if (npmProbe.status !== 0) {
        run('npm', ['install'], { cwd: BENCH_ROOT });
    }

    console.log('Building @node-jhora/core…');
    run('pnpm', ['exec', 'turbo', 'run', 'build', '--filter=@node-jhora/core'], { cwd: REPO_ROOT });

    const py = pythonBin();
    const epochsPath = join(BENCH_ROOT, 'artifacts/epochs.json');

    console.log('Validating Skyfield vs ERFA (DE440-era gate)…');
    run(py, [join(BENCH_ROOT, 'truth/validate_conventions.py')]);

    console.log(`Computing truth for ${epochs.length} epochs…`);
    run(py, [join(BENCH_ROOT, 'truth/compute_truth.py'), epochsPath]);

    for (const mode of ['shared', 'native']) {
        console.log(`Python adapters (${mode} ΔT)…`);
        run(py, [
            join(BENCH_ROOT, 'adapters/run_python.py'),
            epochsPath,
            join(BENCH_ROOT, `artifacts/python_${mode}.json`),
            mode,
        ]);
        console.log(`Node adapters (${mode} ΔT)…`);
        run('node', [
            join(BENCH_ROOT, 'adapters/run_node.mjs'),
            epochsPath,
            join(BENCH_ROOT, `artifacts/node_${mode}.json`),
            mode,
        ]);
    }

    console.log('Analyzing…');
    run('node', [join(BENCH_ROOT, 'analyze.mjs')]);
    console.log('Done.');
}

try {
    main();
} catch (err) {
    console.error(err);
    process.exit(1);
}
