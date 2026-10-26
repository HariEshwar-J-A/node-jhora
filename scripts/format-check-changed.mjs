#!/usr/bin/env node
/**
 * Prettier check scoped to changed files (avoids one-shot reformatting the whole repo).
 * Compares against origin/main by default; set FORMAT_BASE=ref to override.
 *
 * Follow-up: run `pnpm exec prettier --write .` once open PR churn settles.
 */
import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const base = process.env.FORMAT_BASE ?? 'origin/main';

function git(args) {
    return execSync(`git ${args}`, { encoding: 'utf8' }).trim();
}

function listChangedFiles() {
    if (!existsSync('.git')) return [];
    try {
        git(`fetch origin main --quiet`);
    } catch {
        /* offline or shallow */
    }
    const diff = git(`diff --name-only --diff-filter=ACMRTUXB ${base}...HEAD`);
    if (!diff) return [];
    return diff.split('\n').filter(Boolean);
}

const prettierTargets = listChangedFiles().filter(
    (path) =>
        /\.(ts|tsx|mjs|cjs|js|json|md|yml|yaml)$/.test(path) &&
        !path.includes('pnpm-lock.yaml') &&
        !path.endsWith('.bsp'),
);

if (prettierTargets.length === 0) {
    console.log('format:check — no changed Prettier-eligible files vs', base);
    process.exit(0);
}

const result = spawnSync(
    'pnpm',
    ['exec', 'prettier', '--check', ...prettierTargets],
    { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
