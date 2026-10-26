/** Gregorian Julian Day (UT), Meeus — matches packages/core/src/engine/coordinates.ts. */
export function julday(year: number, month: number, day: number, hourUT: number): number {
    let y = year;
    let m = month;
    if (m <= 2) {
        y -= 1;
        m += 12;
    }
    const A = Math.floor(y / 100);
    const B = 2 - A + Math.floor(A / 4);
    return (
        Math.floor(365.25 * (y + 4716)) +
        Math.floor(30.6001 * (m + 1)) +
        day +
        hourUT / 24.0 +
        B -
        1524.5
    );
}

export function jdFromUtc(utc: {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
}): number {
    const hourUT = utc.hour + utc.minute / 60 + utc.second / 3600;
    return julday(utc.year, utc.month, utc.day, hourUT);
}
