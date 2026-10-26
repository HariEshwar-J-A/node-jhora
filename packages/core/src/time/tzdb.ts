/**
 * IANA time zone database access for civil-time resolution.
 *
 * Offsets come from the runtime's `Intl` implementation (ICU's bundled copy of
 * the IANA tz database), read through Luxon. No offsets are hard-coded here.
 *
 * @see https://www.iana.org/time-zones
 */

/**
 * The IANA tzdata release the runtime's `Intl` actually uses, when the
 * runtime exposes it (Node: `process.versions.tz`, e.g. `"2025b"`). Returns
 * `undefined` in environments that don't report it (most browsers), rather
 * than a nominal guess.
 */
export function getTzdbVersion(): string | undefined {
    const proc = (globalThis as { process?: { versions?: { tz?: unknown } } }).process;
    const tz = proc?.versions?.tz;
    return typeof tz === 'string' && tz.length > 0 ? tz : undefined;
}

/** True when `tz` is accepted by the environment's IANA database (via `Intl`). */
export function isValidIanaTimeZone(tz: string): boolean {
    if (!tz) return false;
    try {
        Intl.DateTimeFormat('en-US', { timeZone: tz }).format(0);
        return true;
    } catch {
        return false;
    }
}
