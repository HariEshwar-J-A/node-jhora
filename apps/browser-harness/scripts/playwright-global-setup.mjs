import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export default async function globalSetup() {
    const harnessRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
    const repoRoot = join(harnessRoot, '../..');

    const monorepoBuild = spawnSync('pnpm', ['build'], {
        cwd: repoRoot,
        stdio: 'inherit',
        env: process.env,
    });
    if (monorepoBuild.status !== 0) {
        throw new Error('monorepo pnpm build failed');
    }

    const gen = spawnSync(
        'pnpm',
        ['exec', 'node', 'apps/browser-harness/scripts/generate-fixture.mjs'],
        {
            cwd: repoRoot,
            stdio: 'inherit',
            env: process.env,
        },
    );
    if (gen.status !== 0) {
        throw new Error('generate-fixture.mjs failed');
    }

    const harnessBuild = spawnSync('pnpm', ['run', 'build'], {
        cwd: harnessRoot,
        stdio: 'inherit',
        env: process.env,
    });
    if (harnessBuild.status !== 0) {
        throw new Error('browser-harness vite build failed');
    }
}
