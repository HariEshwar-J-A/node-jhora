import { spawnCliSync } from '../../tools/spawn-cli.mjs';
import { spawnCliSync } from '../../tools/spawn-cli.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export default async function globalSetup() {
    const harnessRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
    const repoRoot = join(harnessRoot, '../..');

    const monorepoBuild = spawnCliSync('pnpm', ['build'], {
        cwd: repoRoot,
        stdio: 'inherit',
        env: process.env,
    });
    if (monorepoBuild.error || monorepoBuild.status !== 0) {
        throw new Error(monorepoBuild.error?.message ?? 'monorepo pnpm build failed');
    }

    const gen = spawnCliSync(
        'pnpm',
        ['exec', 'node', 'apps/browser-harness/scripts/generate-fixture.mjs'],
        {
            cwd: repoRoot,
            stdio: 'inherit',
            env: process.env,
        },
    );
    if (gen.error || gen.status !== 0) {
        throw new Error(gen.error?.message ?? 'generate-fixture.mjs failed');
    }

    const harnessBuild = spawnCliSync('pnpm', ['run', 'build'], {
        cwd: harnessRoot,
        stdio: 'inherit',
        env: process.env,
    });
    if (harnessBuild.error || harnessBuild.status !== 0) {
        throw new Error(harnessBuild.error?.message ?? 'browser-harness vite build failed');
    }
}
