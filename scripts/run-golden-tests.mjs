#!/usr/bin/env node
/**
 * Golden / accuracy suites used by CI (separate from the full unit graph).
 */
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jestBin = path.join(repoRoot, 'node_modules', 'jest', 'bin', 'jest.js');

function runJest(cwd, extraArgs) {
    const result = spawnSync(
        process.execPath,
        ['--experimental-vm-modules', jestBin, '--config', 'jest.config.js', ...extraArgs],
        { cwd: path.join(repoRoot, cwd), stdio: 'inherit', env: process.env },
    );
    if (result.status !== 0) {
        process.exit(result.status ?? 1);
    }
}

runJest('packages/core', ['--testPathPatterns=golden']);
runJest('packages/analytics', ['--testPathPatterns=golden']);
runJest('packages/prediction', ['--testPathPatterns=golden']);
runJest('packages/testkit', ['tests/roundtrip.test.ts', 'tests/schema.test.ts']);
