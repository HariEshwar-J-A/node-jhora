import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseJhd, sexagesimalToDecimal } from '../src/jhd/index.js';

const JHORA12 = join(dirname(fileURLToPath(import.meta.url)), '../../core/tests/fixtures/jhora12');

const manifest = JSON.parse(readFileSync(join(JHORA12, 'MANIFEST.json'), 'utf8')) as {
    charts: {
        name: string;
        local_datetime: string;
        tz_offset_hours: number;
        lat: number;
        lon: number;
    }[];
};

function parseLocalClock(text: string) {
    const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(text);
    if (!m) throw new Error(text);
    return {
        year: +m[1],
        month: +m[2],
        day: +m[3],
        hour: +m[4],
        minute: +m[5],
        second: +m[6],
    };
}

describe('jhora12 .jhd wire format (decimal minutes ÷ 100)', () => {
    test.each(manifest.charts.map((c) => [c.name, c] as const))(
        '%s decodes to MANIFEST',
        (name, row) => {
            const text = readFileSync(join(JHORA12, `${name}.jhd`), 'utf8');
            const chart = parseJhd(text);
            const local = parseLocalClock(row.local_datetime);
            expect(chart.year).toBe(local.year);
            expect(chart.month).toBe(local.month);
            expect(chart.day).toBe(local.day);
            expect(chart.hour).toBeCloseTo(local.hour + local.minute / 60 + local.second / 3600, 9);
            expect(chart.tzHours).toBeCloseTo(row.tz_offset_hours, 6);
            expect(chart.latitude).toBeCloseTo(row.lat, 6);
            expect(chart.longitude).toBeCloseTo(row.lon, 6);
        },
    );

    test('New York longitude documents sub-arcminute packing', () => {
        expect(sexagesimalToDecimal(-74.0036)).toBeCloseTo(-74.006, 9);
    });
});
