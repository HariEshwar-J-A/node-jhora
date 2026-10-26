import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { jhdErrorMessage, JhdParseError } from '../jhd/errors.js';
import { parseJhdDetailed } from '../jhd/parse.js';
import type { JhdParseOptions, JhdParseResult } from '../jhd/types.js';

export interface JhdFileImportSuccess {
    path: string;
    ok: true;
    result: JhdParseResult;
}

export interface JhdFileImportFailure {
    path: string;
    ok: false;
    errors: Array<{ message: string; line?: number; code?: string }>;
}

export type JhdFileImportResult = JhdFileImportSuccess | JhdFileImportFailure;

export interface ImportJhdFolderOptions extends JhdParseOptions {
    /** When true, recurse into subdirectories. @default false */
    recursive?: boolean;
}

function listJhdFiles(dir: string, recursive: boolean): string[] {
    const out: string[] = [];
    for (const name of readdirSync(dir).sort()) {
        const path = join(dir, name);
        const st = statSync(path);
        if (st.isDirectory()) {
            if (recursive) out.push(...listJhdFiles(path, true));
            continue;
        }
        if (name.toLowerCase().endsWith('.jhd')) out.push(path);
    }
    return out;
}

function parseOneFile(path: string, options: JhdParseOptions): JhdFileImportResult {
    try {
        const text = readFileSync(path, 'utf8');
        const result = parseJhdDetailed(text, options);
        return { path, ok: true, result };
    } catch (err) {
        const errors =
            err instanceof JhdParseError
                ? [{ message: err.message, line: err.line, code: err.code }]
                : [{ message: jhdErrorMessage(err) }];
        return { path, ok: false, errors };
    }
}

/**
 * Read every `.jhd` file in a directory. Failures are reported per file with line numbers;
 * successful parses are returned alongside failures (no throw).
 */
export function importJhdFolder(
    directory: string,
    options: ImportJhdFolderOptions = {},
): JhdFileImportResult[] {
    const { recursive = false, ...parseOptions } = options;
    const files = listJhdFiles(directory, recursive);
    return files.map((path) => parseOneFile(path, parseOptions));
}
