#!/usr/bin/env node
/**
 * Check relative links in Markdown files.
 *
 * Uses git to list tracked and untracked files, honouring .gitignore
 * (so CLAUDE.md is skipped). Does not fetch remote URLs.
 *
 * Exit 0 when every relative target exists on disk. Exit 1 otherwise.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';

const root = resolve(new URL('..', import.meta.url).pathname);

const listed = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', '*.md'],
    { cwd: root, encoding: 'utf8' },
);

const files = listed.split('\0').filter(Boolean);
const failures = [];

function isExternal(target) {
    return /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target);
}

function checkTarget(file, line, raw) {
    let target = raw.trim();
    if (target.startsWith('<') && target.endsWith('>')) {
        target = target.slice(1, -1).trim();
    }
    target = target.split(/\s+/)[0] ?? '';
    if (!target || target.startsWith('#') || isExternal(target)) return;

    const hash = target.indexOf('#');
    const pathPart = hash >= 0 ? target.slice(0, hash) : target;
    if (!pathPart) return;

    let decoded;
    try {
        decoded = decodeURIComponent(pathPart);
    } catch {
        failures.push(`${file}:${line}: undecodable link ${raw}`);
        return;
    }

    const abs = resolve(dirname(join(root, file)), decoded);
    const rootPrefix = root.endsWith(sep) ? root : root + sep;
    if (abs !== root && !abs.startsWith(rootPrefix)) {
        failures.push(`${file}:${line}: link escapes the repo (${decoded})`);
        return;
    }
    if (!existsSync(abs)) {
        failures.push(`${file}:${line}: missing ${decoded}`);
    }
}

for (const file of files) {
    const text = readFileSync(join(root, file), 'utf8');
    let inFence = false;
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s*(`{3,}|~{3,})/.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) continue;

        const inline = /!?\[[^\]]*\]\(([^)]+)\)/g;
        let match;
        while ((match = inline.exec(line)) !== null) {
            checkTarget(file, i + 1, match[1]);
        }
        const ref = /^\s{0,3}\[([^\]]+)\]:\s+(\S+)/.exec(line);
        if (ref) checkTarget(file, i + 1, ref[2]);
    }
}

if (files.length === 0) {
    console.error('check-markdown-links: no Markdown files listed by git');
    process.exit(1);
}

if (failures.length > 0) {
    console.error(`check-markdown-links: ${failures.length} broken relative link(s) in ${files.length} file(s)`);
    for (const failure of failures) console.error(`  ${failure}`);
    process.exit(1);
}

console.log(`check-markdown-links: ${files.length} Markdown file(s), relative links ok`);
