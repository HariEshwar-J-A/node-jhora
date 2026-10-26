/**
 * Typed errors for invalid input, range violations, and missing ephemeris data.
 *
 * Public API entry points throw {@link NodeJHoraError} (or a subclass) instead of
 * returning NaN or silently adjusting values.
 */

export const NodeJHoraErrorCode = {
    /** Caller passed a non-finite number, bad enum, invalid calendar, or wrong type. */
    INVALID_INPUT: 'INVALID_INPUT',
    /** A value is finite and well-formed but outside the supported domain (date span, latitude, …). */
    OUT_OF_RANGE: 'OUT_OF_RANGE',
    /** No ephemeris kernel or chunk covers the requested instant (after validation). */
    EPHEMERIS_UNAVAILABLE: 'EPHEMERIS_UNAVAILABLE',
    /** {@link EphemerisEngine.initialize} has not completed successfully. */
    NOT_INITIALIZED: 'NOT_INITIALIZED',
} as const;

export type NodeJHoraErrorCode = (typeof NodeJHoraErrorCode)[keyof typeof NodeJHoraErrorCode];

export class NodeJHoraError extends Error {
    readonly code: NodeJHoraErrorCode;
    readonly detail?: Record<string, unknown>;

    constructor(code: NodeJHoraErrorCode, message: string, detail?: Record<string, unknown>) {
        super(message);
        this.name = 'NodeJHoraError';
        this.code = code;
        this.detail = detail;
    }
}

export function isNodeJHoraError(err: unknown): err is NodeJHoraError {
    return err instanceof NodeJHoraError;
}

/** @internal Map foreign errors (Zod, RangeError) at API boundaries when appropriate. */
export function rethrowAsNodeJHora(err: unknown): never {
    if (err instanceof NodeJHoraError) throw err;
    if (err instanceof RangeError) {
        throw new NodeJHoraError(NodeJHoraErrorCode.OUT_OF_RANGE, err.message);
    }
    throw err;
}
