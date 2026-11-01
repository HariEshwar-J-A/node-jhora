#!/usr/bin/env node
/**
 * Run worker throughput bench under Node and, when installed, Bun and Deno.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const runner = join(repoRoot, 'packages/bench/dist/bench-workers.js');

function which(cmd) {
    return spawnSync('sh', ['-c', `command -v ${cmd}`], { encoding: 'utf8' }).status === 0;
}

function run(label, command, args) {
    console.log(`\n=== ${label} ===\n`);
    if (!existsSync(runner)) {
        console.error(`Missing ${runner} — run pnpm build --filter @node-jhora/bench first.`);
        return false;
    }
    const r = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit', env: process.env });
    return r.status === 0;
}

let ok = run('Node', process.execPath, [runner]);
if (which('bun')) {
    ok = run('Bun', 'bun', [runner]) && ok;
} else {
    console.log('\n(Bun not installed — skipping)\n');
}
if (which('deno')) {
    ok = run('Deno', 'deno', ['run', '--allow-read', '--allow-env', '--allow-ffi', runner]) && ok;
} else {
    console.log('\n(Deno not installed — skipping)\n');
}

process.exit(ok ? 0 : 1);
