import { decimalToSexagesimal } from './sexagesimal.js';
import type { JhdChart, JhdWriteOptions } from './types.js';
import { JHD_BODY_ORDER } from './types.js';

/** Lines 4–7 are always packed sexagesimal (HH.MMSS / DD.MMSS); never write plain decimals. */
function roundTripPacked(decimal: number, flip: boolean): string {
    return decimalToSexagesimal(flip ? -decimal : decimal);
}

function writeCanonical(chart: JhdChart, eol: string): string {
    const lines: string[] = [
        String(chart.month),
        String(chart.day),
        String(chart.year),
        roundTripPacked(chart.hour, false),
        roundTripPacked(chart.tzHours, true),
        roundTripPacked(chart.longitude, true),
        roundTripPacked(chart.latitude, false),
    ];

    if (chart.positions) {
        lines.push(chart.line8Raw !== undefined ? String(chart.line8Raw) : '0');
        for (const body of JHD_BODY_ORDER) {
            lines.push(String(chart.positions[body]));
        }
        const flags = JHD_BODY_ORDER.map((b) => (chart.retrograde?.[b] ? '1' : '0')).join('');
        lines.push(flags);
        return lines.join(eol);
    }

    const altKm =
        chart.altitudeMetres !== undefined ? (chart.altitudeMetres / 1000).toFixed(6) : '0.000000';
    lines.push(altKm);
    const tz = (-chart.tzHours).toFixed(6);
    lines.push(
        tz,
        tz,
        '0',
        '0',
        chart.placeName ?? '',
        chart.country ?? '',
        '1',
        '1013.250000',
        '20.000000',
        '0',
    );
    return lines.join(eol);
}

/** Serialize a chart to `.jhd` text. */
export function writeJhd(chart: JhdChart, options: JhdWriteOptions = {}): string {
    const eol = options.eol ?? '\r\n';
    if (options.meta?.rawLines?.length) {
        return options.meta.rawLines.join(eol);
    }
    return writeCanonical(chart, eol);
}

export function chartsSemanticallyEqual(a: JhdChart, b: JhdChart): boolean {
    const keys: (keyof JhdChart)[] = [
        'year',
        'month',
        'day',
        'hour',
        'tzHours',
        'longitude',
        'latitude',
        'altitudeMetres',
        'line8Raw',
        'placeName',
        'country',
    ];
    for (const k of keys) {
        if (a[k] !== b[k] && !(a[k] === undefined && b[k] === undefined)) {
            if (typeof a[k] === 'number' && typeof b[k] === 'number') {
                if (Math.abs(a[k]! - b[k]!) > 1e-6) return false;
            } else {
                return false;
            }
        }
    }
    if (a.positions && b.positions) {
        for (const body of JHD_BODY_ORDER) {
            if (Math.abs(a.positions[body] - b.positions[body]) > 1e-6) return false;
        }
    } else if (a.positions !== b.positions) return false;

    if (a.retrograde || b.retrograde) {
        for (const body of JHD_BODY_ORDER) {
            if (Boolean(a.retrograde?.[body]) !== Boolean(b.retrograde?.[body])) return false;
        }
    }
    return true;
}
