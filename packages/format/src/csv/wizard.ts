// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

import { suggestCsvColumnMappings } from './mapping.js';
import { detectCsvDelimiter, parseCsvWithDelimiter } from './rfc4180.js';
import { buildChartFromParsedRow, parseMappedRow } from './row-model.js';
import type {
    CsvColumnMapping,
    CsvImportOptions,
    CsvImportResult,
    CsvMappingSuggestion,
    CsvParsedTable,
    CsvParseOptions,
    CsvRowError,
    CsvRowWarning,
    CsvValidateResult,
} from './types.js';

function dataLineNumber(hasHeader: boolean, rowIndex: number): number {
    return (hasHeader ? 2 : 1) + rowIndex;
}

/**
 * Step 1 — parse CSV (RFC 4180, BOM handling) and detect delimiter.
 */
export function csvWizardParse(text: string, options: CsvParseOptions = {}): CsvParsedTable {
    const hasHeader = options.hasHeader ?? true;
    const delimiter = options.delimiter ?? detectCsvDelimiter(text);
    const records = parseCsvWithDelimiter(text, delimiter);
    if (records.length === 0) {
        return { delimiter, hasHeader, headers: [], rows: [] };
    }

    let headers: string[];
    let rows: string[][];

    if (hasHeader) {
        headers = records[0]!.map((h, i) => h.trim() || `column_${i + 1}`);
        rows = records.slice(1).filter((r) => r.some((c) => c.trim().length > 0));
    } else {
        const width = records[0]!.length;
        headers = Array.from({ length: width }, (_, i) => `column_${i + 1}`);
        rows = records.filter((r) => r.some((c) => c.trim().length > 0));
    }

    const width = headers.length;
    rows = rows.map((r) => {
        const copy = r.slice(0, width);
        while (copy.length < width) copy.push('');
        return copy;
    });

    return { delimiter, hasHeader, headers, rows };
}

/**
 * Step 2 — suggest column mappings for standard birth-data fields.
 */
export function csvWizardSuggestMappings(table: CsvParsedTable): CsvMappingSuggestion {
    return suggestCsvColumnMappings(table);
}

/**
 * Step 3 — validate mapped rows; returns per-row errors with source line numbers.
 */
export function csvWizardValidate(
    table: CsvParsedTable,
    mappings: CsvColumnMapping[],
): CsvValidateResult {
    const errors: CsvRowError[] = [];
    const warnings: CsvRowWarning[] = [];
    let validRowCount = 0;

    for (let i = 0; i < table.rows.length; i++) {
        const line = dataLineNumber(table.hasHeader, i);
        const { errors: rowErrors, warnings: rowWarnings } = parseMappedRow(
            table.rows[i]!,
            mappings,
            line,
        );
        warnings.push(...rowWarnings);
        if (rowErrors.length === 0) validRowCount += 1;
        else errors.push(...rowErrors);
    }

    return { validRowCount, errors, warnings };
}

/**
 * Step 4 — build `.njh` v2 chart records for valid rows (invalid rows appear in `errors`).
 */
export function csvWizardBuildCharts(
    table: CsvParsedTable,
    mappings: CsvColumnMapping[],
    options: CsvImportOptions = {},
): CsvImportResult {
    const errors: CsvRowError[] = [];
    const warnings: CsvRowWarning[] = [];
    const results: CsvImportResult['results'] = [];
    const charts: CsvImportResult['charts'] = [];

    for (let i = 0; i < table.rows.length; i++) {
        const line = dataLineNumber(table.hasHeader, i);
        const {
            parsed,
            errors: rowErrors,
            warnings: rowWarnings,
        } = parseMappedRow(table.rows[i]!, mappings, line);
        warnings.push(...rowWarnings);
        if (rowErrors.length > 0 || !parsed) {
            errors.push(...rowErrors);
            results.push({ line, errors: rowErrors, warnings: rowWarnings });
            continue;
        }
        try {
            const chart = buildChartFromParsedRow(parsed, options);
            charts.push(chart);
            results.push({ line, chart, errors: [], warnings: rowWarnings });
        } catch (e) {
            const message = e instanceof Error ? e.message : String(e);
            const err: CsvRowError = { line, message };
            errors.push(err);
            results.push({ line, errors: [err], warnings: rowWarnings });
        }
    }

    return { results, charts, errors, warnings };
}

/**
 * Run all wizard steps in order (convenience for batch import).
 *
 * **DST policy:** wall-clock + IANA zone rows are converted to UTC with the same
 * rules as `resolveCivilTime` in `@node-jhora/core` (default ambiguous policy
 * `'earlier'` for repeated fall-back hours, gap policy `'forward'` for spring-forward
 * gaps). Resolution does not depend on the host time zone or the current system date.
 * Gap rows still emit a `dst_gap` import warning; repeated fall-back times do not.
 */
export function csvWizardImport(
    text: string,
    mappings?: CsvColumnMapping[],
    options: CsvImportOptions & CsvParseOptions = {},
): {
    table: CsvParsedTable;
    suggestion: CsvMappingSuggestion;
    importResult: CsvImportResult;
} {
    const table = csvWizardParse(text, options);
    const suggestion = csvWizardSuggestMappings(table);
    const effectiveMappings = mappings ?? suggestion.mappings;
    const importResult = csvWizardBuildCharts(table, effectiveMappings, options);
    return { table, suggestion, importResult };
}
