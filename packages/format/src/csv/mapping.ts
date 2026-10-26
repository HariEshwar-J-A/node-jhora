import {
    parseCombinedDateTime,
    parseDateField,
    parseGenderField,
    parseLatitude,
    parseLongitude,
    parseTimeField,
    parseTimezoneField,
    parseUtcOffsetMinutes,
} from './field-parsers.js';
import type {
    CsvColumnMapping,
    CsvColumnRole,
    CsvMappingSuggestion,
    CsvParsedTable,
} from './types.js';

const HEADER_HINTS: Record<CsvColumnRole, RegExp[]> = {
    name: [/^name$/i, /^chart\s*name$/i, /^person$/i, /^native$/i, /^title$/i],
    date: [/^date$/i, /^birth\s*date$/i, /^dob$/i, /^day$/i],
    time: [/^time$/i, /^birth\s*time$/i, /^tob$/i, /^hour$/i],
    timezone: [/^time\s*zone$/i, /^timezone$/i, /^tz$/i, /^iana$/i],
    utcOffset: [/^utc\s*offset$/i, /^utc_offset$/i, /^offset$/i, /^gmt$/i],
    place: [/^place$/i, /^city$/i, /^location$/i, /^birth\s*place$/i, /^town$/i],
    latitude: [/^lat$/i, /^latitude$/i, /^lat\b/i],
    longitude: [/^lon$/i, /^lng$/i, /^long$/i, /^longitude$/i],
    gender: [/^sex$/i, /^gender$/i],
    ignore: [],
};

function scoreHeader(header: string, role: CsvColumnRole): number {
    const h = header.trim();
    if (!h) return 0;
    for (const re of HEADER_HINTS[role]) {
        if (re.test(h)) return 0.95;
    }
    const lower = h.toLowerCase();
    if (role === 'latitude' && lower.includes('lat')) return 0.7;
    if (role === 'longitude' && (lower.includes('lon') || lower.includes('lng'))) return 0.7;
    if (role === 'date' && lower.includes('date')) return 0.65;
    if (role === 'time' && lower.includes('time')) return 0.65;
    if (role === 'utcOffset' && /utc.?offset|^gmt$|^offset$/i.test(lower)) return 0.75;
    return 0;
}

function scoreSamples(values: string[], role: CsvColumnRole): number {
    const nonEmpty = values.filter((v) => v.trim().length > 0);
    if (nonEmpty.length === 0) return 0;
    let hits = 0;
    for (const v of nonEmpty) {
        if (role === 'date' && parseDateField(v)) hits += 1;
        else if (role === 'time' && parseTimeField(v)) hits += 1;
        else if (role === 'timezone' && parseTimezoneField(v)) hits += 1;
        else if (role === 'utcOffset' && parseUtcOffsetMinutes(v) !== undefined) hits += 1;
        else if (role === 'latitude' && parseLatitude(v) !== undefined) hits += 1;
        else if (role === 'longitude' && parseLongitude(v) !== undefined) hits += 1;
        else if (role === 'gender' && parseGenderField(v)) hits += 1;
        else if (role === 'name' && v.trim().length >= 2 && !/^\d+$/.test(v.trim())) hits += 1;
        else if (role === 'place' && v.trim().length >= 2) hits += 1;
        else if (role === 'date' && parseCombinedDateTime(v)) hits += 1;
    }
    return hits / nonEmpty.length;
}

const ROLES_TO_SUGGEST: CsvColumnRole[] = [
    'name',
    'date',
    'time',
    'timezone',
    'utcOffset',
    'place',
    'latitude',
    'longitude',
    'gender',
];

/**
 * Step 2 — suggest column mappings from headers and sample cell values.
 */
export function suggestCsvColumnMappings(table: CsvParsedTable): CsvMappingSuggestion {
    const columnCount = table.headers.length;
    const samplesByColumn: Record<number, string[]> = {};
    for (let c = 0; c < columnCount; c++) {
        const samples: string[] = [];
        for (const row of table.rows) {
            const cell = row[c]?.trim() ?? '';
            if (cell && samples.length < 3) samples.push(cell);
        }
        samplesByColumn[c] = samples;
    }

    const scores: { columnIndex: number; role: CsvColumnRole; score: number }[] = [];
    for (let c = 0; c < columnCount; c++) {
        const header = table.headers[c] ?? `column_${c + 1}`;
        const samples = samplesByColumn[c] ?? [];
        for (const role of ROLES_TO_SUGGEST) {
            const headerScore = scoreHeader(header, role);
            const sampleScore = scoreSamples(samples, role);
            const combined = Math.max(headerScore, sampleScore * 0.85);
            if (combined >= 0.5) {
                scores.push({ columnIndex: c, role, score: combined });
            }
        }
    }

    scores.sort((a, b) => b.score - a.score);

    const assignedRole = new Set<CsvColumnRole>();
    const assignedColumn = new Set<number>();
    const mappings: CsvColumnMapping[] = [];
    const confidenceByColumn: Record<number, number> = {};

    for (const entry of scores) {
        if (assignedRole.has(entry.role) || assignedColumn.has(entry.columnIndex)) continue;
        if (entry.role === 'utcOffset' && assignedRole.has('timezone')) {
            // Timezone wins; keep the offset column unmapped rather than letting it fall to `place`.
            assignedColumn.add(entry.columnIndex);
            continue;
        }
        if (entry.role === 'timezone' && assignedRole.has('utcOffset')) continue;
        assignedRole.add(entry.role);
        assignedColumn.add(entry.columnIndex);
        mappings.push({
            columnIndex: entry.columnIndex,
            header: table.headers[entry.columnIndex] ?? `column_${entry.columnIndex + 1}`,
            role: entry.role,
        });
        confidenceByColumn[entry.columnIndex] = entry.score;
    }

    for (let c = 0; c < columnCount; c++) {
        if (!assignedColumn.has(c)) {
            mappings.push({
                columnIndex: c,
                header: table.headers[c] ?? `column_${c + 1}`,
                role: 'ignore',
            });
        }
    }

    mappings.sort((a, b) => a.columnIndex - b.columnIndex);

    return { mappings, confidenceByColumn, samplesByColumn };
}

export function mappingByRole(mappings: CsvColumnMapping[]): Map<CsvColumnRole, number> {
    const map = new Map<CsvColumnRole, number>();
    for (const m of mappings) {
        if (m.role !== 'ignore') map.set(m.role, m.columnIndex);
    }
    return map;
}
