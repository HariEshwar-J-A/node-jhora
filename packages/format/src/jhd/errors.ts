/** Structured parse failure for a single `.jhd` line or file. */
export type JhdErrorCode =
    'too_few_lines' | 'invalid_number' | 'invalid_legacy_tail' | 'invalid_flags';

export class JhdParseError extends Error {
    readonly code: JhdErrorCode;
    readonly line?: number;

    constructor(code: JhdErrorCode, message: string, line?: number) {
        super(message);
        this.name = 'JhdParseError';
        this.code = code;
        this.line = line;
    }
}

export function jhdErrorMessage(err: unknown): string {
    if (err instanceof JhdParseError) {
        return err.line !== undefined ? `${err.message} (line ${err.line})` : err.message;
    }
    if (err instanceof Error) return err.message;
    return String(err);
}
