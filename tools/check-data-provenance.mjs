#!/usr/bin/env node
/**
 * Data-provenance guard.
 *
 * Engine numbers must be calculated, not sampled from another program's
 * output. The only embedded numeric data allowed in library source are cited
 * primary datasets, and each one must say where it came from.
 *
 * Rule: in library source, any array literal holding at least
 * MIN_NUMBERS numeric literals (nested arrays included) must be covered by a
 * comment containing `@provenance` — either in the comment block directly
 * above the statement that contains it, or anywhere in the WINDOW lines
 * before it. Test fixtures are not library source and are not scanned.
 *
 * Enforced (exit 1) under ENFORCED_PREFIXES, where every astronomical number
 * lives. Elsewhere (classical rule tables, UI layout) findings are reported
 * as warnings; pass --strict to enforce everywhere.
 *
 *   node tools/check-data-provenance.mjs [--strict] [root]
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

export const MIN_NUMBERS = 12;
export const ENFORCED_PREFIXES = ['packages/core/src/engine/'];
export const isEnforced = (path) => ENFORCED_PREFIXES.some((p) => path.startsWith(p));
export const WINDOW = 40;
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', 'coverage', 'generated']);

function* walk(dir) {
    for (const name of readdirSync(dir)) {
        if (SKIP_DIRS.has(name)) continue;
        const abs = join(dir, name);
        const st = statSync(abs);
        if (st.isDirectory()) yield* walk(abs);
        else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) yield abs;
    }
}

/** Blank out comments and strings, keeping line structure and offsets. */
function stripCode(src) {
    let out = '';
    let i = 0;
    while (i < src.length) {
        const c = src[i],
            n = src[i + 1];
        if (c === '/' && n === '/') {
            while (i < src.length && src[i] !== '\n') {
                out += ' ';
                i++;
            }
        } else if (c === '/' && n === '*') {
            while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) {
                out += src[i] === '\n' ? '\n' : ' ';
                i++;
            }
            out += '  ';
            i += 2;
        } else if (c === '"' || c === "'" || c === '`') {
            const q = c;
            out += ' ';
            i++;
            while (i < src.length && src[i] !== q) {
                if (src[i] === '\\') {
                    out += '  ';
                    i += 2;
                    continue;
                }
                out += src[i] === '\n' ? '\n' : ' ';
                i++;
            }
            out += ' ';
            i++;
        } else {
            out += c;
            i++;
        }
    }
    return out;
}

/**
 * Find data literals with many numbers: array literals (not index
 * expressions such as `m[0]`), and object literals that initialise a
 * declaration (`const X = { ... }`). Returns [{line, count}] for the outermost.
 */
export function numericArrays(src) {
    const code = stripCode(src);
    const found = [];
    const stack = [];
    const prevChar = (i) => {
        let j = i - 1;
        while (j >= 0 && /\s/.test(code[j])) j--;
        return code[j] ?? '';
    };
    for (let i = 0; i < code.length; i++) {
        const c = code[i];
        if (c === '[' || c === '{') {
            const p = prevChar(i);
            const isIndex = c === '[' && /[A-Za-z0-9_$)\]]/.test(p);
            const isData =
                c === '['
                    ? !isIndex
                    : p === '=' || (stack.length > 0 && stack[stack.length - 1].data);
            stack.push({
                start: i,
                count: 0,
                data:
                    isData &&
                    !(stack.length > 0 && stack[stack.length - 1].data === false && c === '{'),
            });
        } else if ((c === ']' || c === '}') && stack.length) {
            const top = stack.pop();
            const parent = stack.length ? stack[stack.length - 1] : undefined;
            const outermostData = top.data && !(parent && parent.data);
            if (outermostData) {
                if (top.count >= MIN_NUMBERS) {
                    found.push({
                        line: code.slice(0, top.start).split('\n').length,
                        count: top.count,
                    });
                }
            } else if (parent && top.data) parent.count += top.count;
        } else if (
            stack.length &&
            stack[stack.length - 1].data &&
            /[0-9]/.test(c) &&
            !/[A-Za-z0-9_$.]/.test(code[i - 1] ?? '')
        ) {
            const m = /^(?:0x[0-9a-f]+|\d+(?:\.\d*)?(?:e[+-]?\d+)?)/i.exec(code.slice(i));
            if (m) {
                stack[stack.length - 1].count++;
                i += m[0].length - 1;
            }
        }
    }
    return found;
}

export function checkFile(src) {
    const lines = src.split('\n');
    const problems = [];
    for (const { line, count } of numericArrays(src)) {
        const from = Math.max(0, line - 1 - WINDOW);
        const before = lines.slice(from, line).join('\n');
        if (!before.includes('@provenance')) problems.push({ line, count });
    }
    return problems;
}

export function scan(root) {
    const findings = [];
    const pkgs = join(root, 'packages');
    for (const pkg of readdirSync(pkgs)) {
        const srcDir = join(pkgs, pkg, 'src');
        try {
            statSync(srcDir);
        } catch {
            continue;
        }
        for (const file of walk(srcDir)) {
            for (const p of checkFile(readFileSync(file, 'utf8'))) {
                findings.push({ path: relative(root, file).split(sep).join('/'), ...p });
            }
        }
    }
    return findings;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
    const args = process.argv.slice(2);
    const strict = args.includes('--strict');
    const root = args.find((a) => !a.startsWith('--')) ?? process.cwd();
    const findings = scan(root);
    const errors = findings.filter((f) => strict || isEnforced(f.path));
    const warnings = findings.filter((f) => !errors.includes(f));
    for (const f of warnings) {
        console.warn(
            `warning: ${f.path}:${f.line}: numeric table (${f.count} numbers) without an @provenance comment`,
        );
    }
    for (const f of errors) {
        console.error(
            `${f.path}:${f.line}: numeric table (${f.count} numbers) without an @provenance comment`,
        );
    }
    if (errors.length) {
        console.error(
            `\n${errors.length} data table(s) lack provenance. Cite the primary dataset with @provenance.`,
        );
        process.exit(1);
    }
    console.log(
        `data provenance: every enforced numeric table cites its source (${warnings.length} warning(s) outside ${ENFORCED_PREFIXES.join(', ')})`,
    );
}
