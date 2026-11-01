#!/usr/bin/env node
/**
 * Clean-room asset guard. See docs/guides/clean-room.md.
 *
 * Fails when the tree contains:
 *   - .chm / .hlp help files, .ico / .bmp images, .exe / .dll binaries
 *   - .jhd chart files outside the fixture allowlist
 *   - decompiler markers ("Decompiled by", "Ghidra", "undefined4")
 *
 *   node tools/check-forbidden-assets.mjs [root]
 *
 * The policy docs and this script name those markers, so content scanning
 * skips only the paths in CONTENT_EXEMPT. Reviewers read those diffs by hand.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', '.turbo', '.next']);

/** Extensions that do not belong in this repository at all. */
export const FORBIDDEN_EXTENSIONS = new Set(['.chm', '.hlp', '.ico', '.bmp', '.exe', '.dll']);

/**
 * Case-insensitive substrings typical of decompiler listings.
 * Compared against a lowercased copy of the file.
 */
export const MARKERS = ['decompiled by', 'ghidra', 'undefined4'];

/** Paths allowed to *name* the markers. Not a place for copied material. */
export const CONTENT_EXEMPT = new Set([
    'tools/check-forbidden-assets.mjs',
    'tools/check-forbidden-assets.test.mjs',
    'docs/guides/clean-room.md',
    'docs/decisions/0002-clean-room-policy.md',
    // Gitignored copies synced from the two policy docs above by
    // apps/docs/scripts/prepare-content.mjs during `pnpm run docs:build`.
    'apps/docs/src/content/docs/guides/clean-room.md',
    'apps/docs/src/content/docs/guides/decisions-0002-clean-room-policy.md',
]);

const TEXT_EXTENSIONS = new Set([
    '.ts',
    '.tsx',
    '.js',
    '.mjs',
    '.cjs',
    '.jsx',
    '.md',
    '.json',
    '.txt',
    '.html',
    '.css',
    '.yml',
    '.yaml',
    '.csv',
    '.ini',
    '.py',
    '.java',
    '.cs',
    '.c',
    '.h',
]);

const MAX_TEXT_BYTES = 1_000_000;

export function toPosix(rel) {
    return rel.split(sep).join('/');
}

/** `.jhd` fixtures are allowed only under these relative paths. */
export function isAllowedJhd(relPosix) {
    if (relPosix === 'test-fixtures' || relPosix.startsWith('test-fixtures/')) {
        return true;
    }
    return /^packages\/[^/]+\/tests\/(?:.*\/)?fixtures\//.test(relPosix);
}

function extensionOf(name) {
    const dot = name.lastIndexOf('.');
    if (dot <= 0) return '';
    return name.slice(dot).toLowerCase();
}

/**
 * Walk `root` and return findings. Each finding is
 * `{ path, rule, detail }` with `path` relative and POSIX.
 */
export function scan(root) {
    const findings = [];

    function visit(dir) {
        let entries;
        try {
            entries = readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const entry of entries) {
            if (entry.isDirectory()) {
                if (SKIP_DIRS.has(entry.name)) continue;
                visit(join(dir, entry.name));
                continue;
            }
            if (!entry.isFile()) continue;

            const abs = join(dir, entry.name);
            const rel = toPosix(relative(root, abs));
            const ext = extensionOf(entry.name);

            if (FORBIDDEN_EXTENSIONS.has(ext)) {
                findings.push({
                    path: rel,
                    rule: 'forbidden-extension',
                    detail: `${ext} files are not allowed anywhere in the tree`,
                });
                continue;
            }

            if (ext === '.jhd' && !isAllowedJhd(rel)) {
                findings.push({
                    path: rel,
                    rule: 'jhd-outside-fixtures',
                    detail: '.jhd files are allowed only under packages/<pkg>/tests/fixtures/ or test-fixtures/',
                });
                continue;
            }

            if (CONTENT_EXEMPT.has(rel) || !TEXT_EXTENSIONS.has(ext)) continue;

            let text;
            try {
                text = readFileSync(abs);
            } catch {
                continue;
            }
            if (text.length > MAX_TEXT_BYTES) continue;
            if (text.includes(0)) continue;

            const haystack = text.toString('utf8').toLowerCase();
            for (const marker of MARKERS) {
                if (haystack.includes(marker)) {
                    findings.push({
                        path: rel,
                        rule: 'decompiler-marker',
                        detail: `found marker ${JSON.stringify(marker)}`,
                    });
                }
            }
        }
    }

    visit(root);
    findings.sort((a, b) => a.path.localeCompare(b.path) || a.rule.localeCompare(b.rule));
    return findings;
}

function isMain() {
    const entry = process.argv[1];
    if (!entry) return false;
    return import.meta.url === pathToFileURL(entry).href;
}

if (isMain()) {
    const root = process.argv[2] ?? process.cwd();
    const findings = scan(root);
    if (findings.length === 0) {
        console.log(`check-forbidden-assets: clean (${root})`);
        process.exit(0);
    }
    console.error(`check-forbidden-assets: ${findings.length} finding(s) under ${root}`);
    for (const finding of findings) {
        console.error(`  ${finding.rule}  ${finding.path}  ${finding.detail}`);
    }
    process.exit(1);
}
