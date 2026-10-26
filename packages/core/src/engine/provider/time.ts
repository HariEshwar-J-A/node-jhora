/** J2000.0 epoch in TDB/TT Julian days (IAU). */
export const J2000_JD = 2451545.0;

/** Seconds per day (exact). */
export const SECONDS_PER_DAY = 86400;

/** Ephemeris time (seconds from J2000.0 TDB) from a TDB Julian day. */
export function jdTdbToEt(jdTdb: number): number {
    return (jdTdb - J2000_JD) * SECONDS_PER_DAY;
}

export function etToJdTdb(et: number): number {
    return et / SECONDS_PER_DAY + J2000_JD;
}
