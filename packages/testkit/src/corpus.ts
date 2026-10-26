import { type GoldenCase, GoldenCaseSchema } from './schema.js';

/** Parse a JSON array, a single JSON object, or JSON Lines into golden cases. */
export function parseGoldenCorpus(text: string): GoldenCase[] {
    const trimmed = text.trim();
    if (!trimmed) return [];
    try {
        const parsed = JSON.parse(trimmed) as unknown;
        const cases = Array.isArray(parsed) ? parsed : [parsed];
        return GoldenCaseSchema.array().parse(cases);
    } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;
    }
    return trimmed
        .split(/\r?\n/)
        .filter((line) => line.trim().length > 0)
        .map((line) => GoldenCaseSchema.parse(JSON.parse(line)));
}

/** One case per line. Key order is the order on each case object. */
export function formatGoldenJsonl(cases: readonly GoldenCase[]): string {
    return `${cases.map((item) => JSON.stringify(item)).join('\n')}\n`;
}

export function formatGoldenJson(cases: readonly GoldenCase[]): string {
    return `${JSON.stringify(cases, null, 2)}\n`;
}
