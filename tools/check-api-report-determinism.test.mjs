/**
 * API surface reports must not depend on stale Turbo-restored dist or build order.
 * TypeScript declaration emit for Zod enums is stable on clean builds; flakes came from
 * mismatched dist/** vs etc/** when tsconfig.tsbuildinfo was not in Turbo outputs.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { assertSpawnOk, spawnCliSync } from './spawn-cli.mjs';
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');

function sha256(path) {
    return createHash('sha256')
        .update(readFileSync(join(root, path)))
        .digest('hex');
}

function runArgv(argv) {
    const [cmd, ...args] = argv;
    const env = { ...process.env, FORCE_COLOR: '0' };
    const result =
        cmd === 'pnpm'
            ? spawnCliSync('pnpm', args, { cwd: root, stdio: 'pipe', env })
            : spawnSync(cmd, args, { cwd: root, stdio: 'pipe', env });
    assertSpawnOk(result, cmd);
}

test('core/format .d.ts enum order is stable across clean rebuilds', () => {
    const digests = new Set();
    for (let i = 0; i < 3; i++) {
        rmSync(join(root, 'packages/core/dist'), { recursive: true, force: true });
        rmSync(join(root, 'packages/format/dist'), { recursive: true, force: true });
        rmSync(join(root, 'packages/core/tsconfig.tsbuildinfo'), { force: true });
        rmSync(join(root, 'packages/format/tsconfig.tsbuildinfo'), { force: true });
        runArgv([
            'pnpm',
            'exec',
            'tsc',
            '-b',
            'packages/core/tsconfig.json',
            'packages/format/tsconfig.json',
        ]);
        digests.add(
            sha256('packages/format/dist/schema.d.ts') +
                ':' +
                sha256('packages/core/dist/settings/schema.d.ts'),
        );
    }
    assert.equal(digests.size, 1);
});

test('api-extractor reports match committed etc after a forced package build', () => {
    rmSync(join(root, 'temp'), { recursive: true, force: true });
    runArgv([
        'pnpm',
        'exec',
        'turbo',
        'run',
        'build',
        '--force',
        '--filter=@node-jhora/core',
        '--filter=@node-jhora/format',
    ]);
    for (const pkg of ['core', 'format']) {
        rmSync(join(root, 'temp'), { recursive: true, force: true });
        runArgv(['pnpm', '--filter', `@node-jhora/${pkg}`, 'api:report']);
        if (pkg === 'format') {
            runArgv(['node', 'tools/normalize-format-api-report.mjs', 'temp/format.api.md']);
        }
        const report = `etc/${pkg}.api.md`;
        const temp = `temp/${pkg}.api.md`;
        assert.equal(
            sha256(report),
            sha256(temp),
            `${report} must match api-extractor output (rebuild packages if this fails)`,
        );
    }
});
