#!/usr/bin/env node
/**
 * Sort ZodEnum member lines in etc/format.api.md so api:check is stable across
 * OS/TS emit order (object key ordering in declaration emit can vary).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const reportPath = join(root, 'etc/format.api.md');

const MEMBER = /^(\s+)([A-Za-z0-9_]+): "(.+)";$/;

function normalizeReport(text) {
    const lines = text.split('\n').map((l) => l.replace(/\r$/, ''));
    const out = [];
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (line.includes('z.ZodEnum<{') || line.includes('ZodEnum<{')) {
            out.push(line);
            i++;
            const block = [];
            while (i < lines.length && !lines[i].includes('}>')) {
                const m = MEMBER.exec(lines[i]);
                if (m) block.push(lines[i]);
                else out.push(lines[i]);
                i++;
            }
            block.sort((a, b) => {
                const ka = MEMBER.exec(a)?.[2] ?? a;
                const kb = MEMBER.exec(b)?.[2] ?? b;
                return ka.localeCompare(kb);
            });
            out.push(...block);
            if (i < lines.length) {
                out.push(lines[i]);
                i++;
            }
            continue;
        }
        out.push(line);
        i++;
    }
    return out.join('\n');
}

const check = process.argv.includes('--check');
const pathArg = process.argv.find((a) => a.endsWith('.md') && !a.startsWith('-'));
const targetPath = pathArg ? join(root, pathArg) : reportPath;
const text = readFileSync(targetPath, 'utf8');
const normalized = normalizeReport(text);
if (check) {
    if (normalized !== text) {
        console.error(
            `${pathArg ?? 'etc/format.api.md'} is not normalized — run: node tools/normalize-format-api-report.mjs`,
        );
        process.exit(1);
    }
    process.exit(0);
}
if (normalized !== text) {
    writeFileSync(targetPath, normalized);
    console.log(`Normalized ${pathArg ?? 'etc/format.api.md'}`);
}
