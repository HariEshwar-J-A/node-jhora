// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

import type { CsvDelimiter } from './types.js';

const UTF8_BOM = '\uFEFF';

export function stripBom(text: string): string {
    return text.startsWith(UTF8_BOM) ? text.slice(1) : text;
}

/**
 * Parse CSV text per RFC 4180 (quoted fields, doubled quotes, CRLF/LF).
 * Returns physical rows; caller decides header handling.
 */
export function parseCsvRecords(text: string): string[][] {
    const input = stripBom(text);
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;
    let i = 0;

    while (i < input.length) {
        const ch = input[i]!;

        if (inQuotes) {
            if (ch === '"') {
                if (input[i + 1] === '"') {
                    field += '"';
                    i += 2;
                    continue;
                }
                inQuotes = false;
                i += 1;
                continue;
            }
            field += ch;
            i += 1;
            continue;
        }

        if (ch === '"') {
            inQuotes = true;
            i += 1;
            continue;
        }

        if (ch === ',') {
            row.push(field);
            field = '';
            i += 1;
            continue;
        }

        if (ch === '\r') {
            row.push(field);
            field = '';
            rows.push(row);
            row = [];
            if (input[i + 1] === '\n') i += 2;
            else i += 1;
            continue;
        }

        if (ch === '\n') {
            row.push(field);
            field = '';
            rows.push(row);
            row = [];
            i += 1;
            continue;
        }

        field += ch;
        i += 1;
    }

    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    // Trim a single empty trailing row from a final newline.
    if (
        rows.length > 0 &&
        rows[rows.length - 1]!.length === 1 &&
        rows[rows.length - 1]![0] === ''
    ) {
        const last = rows[rows.length - 1]!;
        if (rows.length > 1 || last[0] !== '') {
            const prev = rows[rows.length - 2];
            if (prev && prev.length === 1 && prev[0] === '' && last[0] === '') {
                rows.pop();
            }
        }
    }

    return rows;
}

const CANDIDATE_DELIMITERS: CsvDelimiter[] = [',', ';', '\t', '|'];

function countDelimiterOutsideQuotes(line: string, delimiter: string): number {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i]!;
        if (ch === '"') {
            if (inQuotes && line[i + 1] === '"') {
                i += 1;
                continue;
            }
            inQuotes = !inQuotes;
            continue;
        }
        if (!inQuotes && ch === delimiter) count += 1;
    }
    return count;
}

/** Pick the delimiter that yields the most fields on the first non-empty line. */
export function detectCsvDelimiter(text: string): CsvDelimiter {
    const stripped = stripBom(text);
    const firstLine = stripped.split(/\r\n|\n|\r/).find((l) => l.trim().length > 0) ?? '';
    let best: CsvDelimiter = ',';
    let bestCount = -1;
    for (const d of CANDIDATE_DELIMITERS) {
        const c = countDelimiterOutsideQuotes(firstLine, d);
        if (c > bestCount) {
            bestCount = c;
            best = d;
        }
    }
    return best;
}

/** Re-parse with a non-comma delimiter by translating delimiters (RFC rows use comma internally). */
export function parseCsvWithDelimiter(text: string, delimiter: CsvDelimiter): string[][] {
    if (delimiter === ',') return parseCsvRecords(text);
    const stripped = stripBom(text);
    const translated = translateDelimiter(stripped, delimiter);
    return parseCsvRecords(translated);
}

function translateDelimiter(text: string, delimiter: CsvDelimiter): string {
    let out = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i]!;
        if (ch === '"') {
            if (inQuotes && text[i + 1] === '"') {
                out += '""';
                i += 1;
                continue;
            }
            inQuotes = !inQuotes;
            out += ch;
            continue;
        }
        if (!inQuotes && ch === delimiter) {
            out += ',';
            continue;
        }
        out += ch;
    }
    return out;
}
