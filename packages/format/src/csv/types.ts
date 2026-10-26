import type { NjhChartV2 } from '../schema.js';

/** Logical CSV column roles the wizard can map. */
export type CsvColumnRole =
    | 'name'
    | 'date'
    | 'time'
    | 'timezone'
    | 'utcOffset'
    | 'place'
    | 'latitude'
    | 'longitude'
    | 'gender'
    | 'ignore';

export type CsvDelimiter = ',' | ';' | '\t' | '|';

/** Result of step 1 — RFC 4180 parse with detected delimiter. */
export interface CsvParsedTable {
    delimiter: CsvDelimiter;
    /** True when the first row was treated as column headers. */
    hasHeader: boolean;
    headers: string[];
    /** Data rows (strings per column); line numbers for errors start at 2 when hasHeader. */
    rows: string[][];
}

export interface CsvColumnMapping {
    columnIndex: number;
    header: string;
    role: CsvColumnRole;
}

/** Result of step 2 — heuristic mapping suggestions. */
export interface CsvMappingSuggestion {
    mappings: CsvColumnMapping[];
    /** 0–1 score per suggested role assignment (columnIndex → confidence). */
    confidenceByColumn: Record<number, number>;
    /** Sample non-empty cell values per column (up to 3). */
    samplesByColumn: Record<number, string[]>;
}

export interface CsvRowError {
    /** 1-based line number in the original CSV text (header is line 1 when present). */
    line: number;
    column?: string;
    message: string;
}

export interface CsvValidateResult {
    validRowCount: number;
    errors: CsvRowError[];
}

export interface CsvImportRowResult {
    line: number;
    chart?: NjhChartV2;
    errors: CsvRowError[];
}

export interface CsvImportResult {
    results: CsvImportRowResult[];
    charts: NjhChartV2[];
    errors: CsvRowError[];
}

export interface CsvParseOptions {
    /** When true (default), the first row is column headers. */
    hasHeader?: boolean;
    /** Force a delimiter instead of auto-detection. */
    delimiter?: CsvDelimiter;
}

export interface CsvImportOptions {
    /** Used when rows supply UTC offset but no IANA zone (default `natal`). */
    chartKind?: 'natal' | 'event' | 'mundane' | 'prasna' | 'return' | 'other';
    /** Default altitude in metres when not present in CSV (default 0). */
    altitudeMetres?: number;
    /** Tag added to every imported chart (default `csv-import`). */
    importTag?: string;
}
