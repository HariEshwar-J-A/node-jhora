/**
 * Jest helpers for golden cases. Node/Jest only — not required for the comparator core.
 */

import {
    compareGoldenCase,
    type CompareGoldenOptions,
    type GoldenActual,
    type GoldenCompareResult,
} from './compare.js';
import { formatGoldenReportText } from './report.js';
import type { GoldenCase } from './schema.js';

export function expectGolden(
    goldenCase: GoldenCase,
    actual: GoldenActual,
    options?: CompareGoldenOptions,
): GoldenCompareResult {
    const result = compareGoldenCase(goldenCase, actual, options);
    if (!result.pass) {
        throw new Error(formatGoldenReportText(result));
    }
    return result;
}

interface GoldenMatcherState {
    result: ReturnType<typeof compareGoldenCase>;
}

export function installGoldenMatchers(): void {
    const jestExpect = (globalThis as { expect?: { extend: (m: unknown) => void } }).expect;
    if (!jestExpect?.extend) return;

    jestExpect.extend({
        toMatchGoldenCase(
            received: GoldenActual,
            goldenCase: GoldenCase,
            options?: CompareGoldenOptions,
        ) {
            const result = compareGoldenCase(goldenCase, received, options);
            void ({ result } satisfies GoldenMatcherState);
            if (result.pass) {
                return {
                    pass: true,
                    message: () =>
                        `Expected golden case ${goldenCase.id} to fail, but all paths matched.`,
                };
            }
            return {
                pass: false,
                message: () => formatGoldenReportText(result),
            };
        },
    });
}

declare global {
    namespace jest {
        interface Matchers<R> {
            toMatchGoldenCase(goldenCase: GoldenCase, options?: CompareGoldenOptions): R;
        }
    }
}
