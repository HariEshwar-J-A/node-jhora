import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

describe('bench:workers smoke', () => {
    test('worker throughput bench completes in smoke mode (Node)', () => {
        const repoRoot = fileURLToPath(new URL('../../..', import.meta.url));
        const runner = join(repoRoot, 'packages/bench/dist/bench-workers.js');
        const r = spawnSync(process.execPath, [runner], {
            cwd: repoRoot,
            env: { ...process.env, NODE_JHORA_BENCH_WORKERS_SMOKE: '1' },
            encoding: 'utf8',
            timeout: 180_000,
        });
        if (r.status !== 0) {
            throw new Error(r.stderr || r.stdout || `exit ${r.status}`);
        }
        expect(r.stdout).toMatch(/worker throughput bench/);
        expect(r.stdout).toMatch(/charts\/s/);
    }, 200_000);
});
