/** True when `tz` is accepted by the environment's IANA database (via `Intl`). */
export function isValidIanaTimeZone(tz: string): boolean {
    if (!tz) return false;
    try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
    } catch {
        return false;
    }
}
