#!/usr/bin/env node
/**
 * Run Jest with WRITE_GOLDENS=1 (Windows-safe; POSIX env assignment is not).
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

process.env.WRITE_GOLDENS = '1';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const jestBin = path.join(repoRoot, 'node_modules', 'jest', 'bin', 'jest.js');

const result = spawnSync(
    process.execPath,
    ['--experimental-vm-modules', jestBin, ...process.argv.slice(2)],
    { stdio: 'inherit', env: process.env },
);

process.exit(result.status ?? 1);
