import { detectJhdVariant } from './detect.js';
import { JhdParseError } from './errors.js';
import { sexagesimalToDecimal } from './sexagesimal.js';
import type {
    JhdBody,
    JhdChart,
    JhdFileMeta,
    JhdLine8AltitudeMode,
    JhdParseOptions,
    JhdParseResult,
} from './types.js';
import { JHD_BODY_ORDER } from './types.js';

function parseNumberLine(lines: string[], index: number): number {
    const raw = lines[index];
    if (raw === undefined || raw === '') {
        throw new JhdParseError('invalid_number', `jhd: line ${index + 1} is empty`, index + 1);
    }
    const v = Number(raw);
    if (!Number.isFinite(v)) {
        throw new JhdParseError(
            'invalid_number',
            `jhd: line ${index + 1} is not a number: ${JSON.stringify(raw)}`,
            index + 1,
        );
    }
    return v;
}

function applyLine8Altitude(
    raw: number,
    mode: JhdLine8AltitudeMode,
    variant: 'legacy' | 'modern',
): { altitudeMetres?: number; applied: JhdFileMeta['line8AltitudeApplied'] } {
    if (variant === 'legacy') {
        if (mode === 'metres') return { altitudeMetres: raw, applied: 'metres' };
        if (mode === 'kilometres') return { altitudeMetres: raw * 1000, applied: 'kilometres' };
        return { applied: 'legacy-ignored' };
    }

    switch (mode) {
        case 'ignore':
            return { applied: 'ignore' };
        case 'metres':
            return { altitudeMetres: raw, applied: 'metres' };
        case 'kilometres':
        case 'auto':
        default:
            return {
                altitudeMetres: raw * 1000,
                applied: mode === 'auto' ? 'kilometres' : 'kilometres',
            };
    }
}

/**
 * Parse `.jhd` text (CRLF or LF). Throws {@link JhdParseError} with a line number when possible.
 */
export function parseJhdDetailed(text: string, options: JhdParseOptions = {}): JhdParseResult {
    const line8Mode: JhdLine8AltitudeMode = options.line8Altitude ?? 'auto';
    const lines = text
        .replace(/\r/g, '')
        .split('\n')
        .map((l) => l.trim());

    if (lines.length < 7) {
        throw new JhdParseError(
            'too_few_lines',
            `jhd: expected at least 7 lines, found ${lines.length}`,
        );
    }

    const chart: JhdChart = {
        month: parseNumberLine(lines, 0),
        day: parseNumberLine(lines, 1),
        year: parseNumberLine(lines, 2),
        hour: sexagesimalToDecimal(parseNumberLine(lines, 3)),
        tzHours: -sexagesimalToDecimal(parseNumberLine(lines, 4)),
        longitude: -sexagesimalToDecimal(parseNumberLine(lines, 5)),
        latitude: sexagesimalToDecimal(parseNumberLine(lines, 6)),
    };

    const variant = detectJhdVariant(lines);
    let line8AltitudeApplied: JhdFileMeta['line8AltitudeApplied'] =
        variant === 'legacy' ? 'legacy-ignored' : 'kilometres';

    if (lines[7] !== undefined && lines[7] !== '') {
        const raw = parseNumberLine(lines, 7);
        chart.line8Raw = raw;
        const alt = applyLine8Altitude(raw, line8Mode, variant);
        line8AltitudeApplied = alt.applied;
        if (alt.altitudeMetres !== undefined) chart.altitudeMetres = alt.altitudeMetres;
    }

    if (variant === 'legacy') {
        const tail = lines.slice(8, 17);
        const flags = lines[17] ?? '';
        if (tail.length !== 9) {
            throw new JhdParseError(
                'invalid_legacy_tail',
                `jhd: legacy layout expects 9 longitude lines (9–17), found ${tail.length}`,
                9,
            );
        }
        if (!/^[01]{9}$/.test(flags)) {
            throw new JhdParseError(
                'invalid_flags',
                `jhd: line 18 must be nine retrograde flags (0/1), got ${JSON.stringify(flags)}`,
                18,
            );
        }

        const positions = {} as Record<JhdBody, number>;
        const retrograde = {} as Partial<Record<JhdBody, boolean>>;
        JHD_BODY_ORDER.forEach((body, i) => {
            positions[body] = parseNumberLine(tail, i);
            retrograde[body] = flags[i] === '1';
        });
        chart.positions = positions;
        chart.retrograde = retrograde;

        return {
            chart,
            meta: {
                variant: 'legacy',
                line8AltitudeApplied,
                rawLines: lines,
            },
        };
    }

    if (lines[12]) chart.placeName = lines[12];
    if (lines[13]) chart.country = lines[13];

    return {
        chart,
        meta: {
            variant: 'modern',
            line8AltitudeApplied,
            rawLines: lines,
        },
    };
}

/** Parse and return only the chart (same shape tools used from `@node-jhora/core`). */
export function parseJhd(text: string, options?: JhdParseOptions): JhdChart {
    return parseJhdDetailed(text, options).chart;
}

export function hasPositions(chart: JhdChart): boolean {
    return chart.positions !== undefined;
}
