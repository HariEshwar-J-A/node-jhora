import * as fc from 'fast-check';

import { JhdParseError } from '../src/jhd/errors.js';
import { parseJhdDetailed } from '../src/jhd/parse.js';

const HEADER = ['8', '8', '1912', '19.3800', '-5.30', '-77.35', '12.59'];

describe('jhd fuzz', () => {
    test('random line noise fails with line numbers or too_few_lines', () => {
        fc.assert(
            fc.property(
                fc.array(fc.string({ maxLength: 40 }), { minLength: 0, maxLength: 30 }),
                (lines) => {
                    const text = lines.join('\n');
                    try {
                        parseJhdDetailed(text);
                    } catch (e) {
                        expect(e).toBeInstanceOf(JhdParseError);
                        const err = e as JhdParseError;
                        if (err.code === 'invalid_number') {
                            expect(err.line).toBeGreaterThanOrEqual(1);
                        }
                    }
                },
            ),
            { seed: 106, numRuns: 200 },
        );
    });

    test('legacy tail with out-of-range longitude is still modern path', () => {
        fc.assert(
            fc.property(fc.double({ min: 360, max: 1000, noNaN: true }), (badLon) => {
                const lines = [
                    ...HEADER,
                    '0.5',
                    String(badLon),
                    ...Array(8).fill('100'),
                    '000000000',
                ];
                const { meta } = parseJhdDetailed(lines.join('\n'));
                expect(meta.variant).toBe('modern');
            }),
            { seed: 106, numRuns: 50 },
        );
    });
});
