/**
 * jhd.ts — Reader for Jagannatha Hora `.jhd` chart files.
 *
 * `.jhd` is a plain-text, CRLF-terminated format with one value per line. Two
 * variants exist and are distinguished by what follows line 8.
 *
 * ── Common header (lines 1-8) ───────────────────────────────────────────────
 *   1  month           integer, 1-12
 *   2  day             integer
 *   3  year            integer
 *   4  local time      HH.MMSS sexagesimal — 19.3800 is 19:38:00, NOT 19.38 h
 *   5  time zone       HH.MM sexagesimal, sign-flipped — -5.30 is UTC+5:30
 *   6  longitude       DDD.MM sexagesimal, sign-flipped — -77.35 is 77°35′ E
 *   7  latitude        DD.MM sexagesimal — 12.59 is 12°59′ N
 *   8  altitude (km) in the modern variant; an unrelated fraction in the legacy one
 *
 * ── Modern variant (lines 9+) ───────────────────────────────────────────────
 *   9  time zone, decimal hours, sign-flipped (-5.5 = UTC+5:30)
 *  10  same, after any DST adjustment
 *  11  reserved
 *  12  place index
 *  13  place name
 *  14  country
 *  15  reserved
 *  16  atmospheric pressure, hPa
 *  17  temperature, °C
 *
 * ── Legacy variant (lines 9+) ───────────────────────────────────────────────
 *  9-17  nine sidereal longitudes, in JHora's own display order:
 *        Sun, Moon, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, **Lagna**
 *  18    nine retrograde flags, one character each, aligned to the above
 *
 * The legacy variant is far more useful for validation: it carries JHora's
 * *computed* output, not just the birth data, so a file alone is a complete
 * regression case.
 *
 * ── Caution ─────────────────────────────────────────────────────────────────
 * The sexagesimal encoding of lines 4-7 is the trap. Reading `-5.30` as 5.5
 * decimal hours is off by 18 minutes of clock time, which moves the ascendant
 * about 4.5° — enough to change the rising sign while every planet still looks
 * fine. Always parse through {@link sexagesimalToDecimal}.
 */

/**
 * Convert JHora's DD.MMSS packing to decimal degrees or hours.
 *
 * `19.38`   → 19 + 38/60                 = 19.6333
 * `-77.35`  → -(77 + 35/60)              = -77.5833
 * `6.3300`  → 6 + 33/60                  = 6.55
 * `12.5930` → 12 + 59/60 + 30/3600       = 12.9917
 */
export function sexagesimalToDecimal(packed: number): number {
    const sign = packed < 0 ? -1 : 1;
    const abs  = Math.abs(packed);

    const whole = Math.floor(abs);
    // Recover the fractional digits as MMSSss without float drift at the edges.
    const frac  = abs - whole;

    const minutes = Math.floor(frac * 100 + 1e-9);
    const seconds = (frac * 100 - minutes) * 100;

    return sign * (whole + minutes / 60 + seconds / 3600);
}

/** Bodies in the order JHora writes them into a legacy `.jhd`. */
export const JHD_BODY_ORDER = [
    'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Lagna',
] as const;

export type JhdBody = typeof JHD_BODY_ORDER[number];

export interface JhdChart {
    /** Calendar date of birth. */
    year:   number;
    month:  number;
    day:    number;
    /** Local clock time, decimal hours. */
    hour:   number;
    /** Offset east of UTC, decimal hours (+5.5 for India). */
    tzHours: number;
    /** Degrees east, decimal (negative = west). */
    longitude: number;
    /** Degrees north, decimal (negative = south). */
    latitude:  number;
    /** Metres above sea level, when the file records it. */
    altitude?: number;
    placeName?: string;
    country?:   string;

    /**
     * JHora's own computed sidereal longitudes, when the file is the legacy
     * variant. Absent for modern files, which store birth data only.
     */
    positions?: Record<JhdBody, number>;
    /** Retrograde flags parallel to `positions`, when present. */
    retrograde?: Partial<Record<JhdBody, boolean>>;
}

/** True when the file carries JHora's computed positions. */
export function hasPositions(chart: JhdChart): boolean {
    return chart.positions !== undefined;
}

/**
 * Parse the contents of a `.jhd` file.
 *
 * @param text Raw file contents (CRLF or LF line endings both accepted)
 */
export function parseJhd(text: string): JhdChart {
    const lines = text.replace(/\r/g, '').split('\n').map(l => l.trim());

    if (lines.length < 7) {
        throw new Error(`jhd: expected at least 7 lines, found ${lines.length}`);
    }

    const num = (i: number): number => {
        const v = Number(lines[i]);
        if (!Number.isFinite(v)) {
            throw new Error(`jhd: line ${i + 1} is not a number: ${JSON.stringify(lines[i])}`);
        }
        return v;
    };

    const chart: JhdChart = {
        month: num(0),
        day:   num(1),
        year:  num(2),
        hour:      sexagesimalToDecimal(num(3)),
        // Lines 5 and 6 are sign-flipped: east of Greenwich is stored negative.
        tzHours:   -sexagesimalToDecimal(num(4)),
        longitude: -sexagesimalToDecimal(num(5)),
        latitude:   sexagesimalToDecimal(num(6)),
    };

    // Distinguish the variants. In the legacy layout lines 9-17 are nine
    // longitudes in [0, 360) and line 18 is a nine-character flag string.
    const tail = lines.slice(8, 17);
    const flags = lines[17] ?? '';

    const looksLegacy =
        tail.length === 9 &&
        tail.every(l => l !== '' && Number.isFinite(Number(l))
                     && Number(l) >= 0 && Number(l) < 360) &&
        /^[01]{9}$/.test(flags);

    if (looksLegacy) {
        const positions  = {} as Record<JhdBody, number>;
        const retrograde = {} as Partial<Record<JhdBody, boolean>>;

        JHD_BODY_ORDER.forEach((body, i) => {
            positions[body]  = Number(tail[i]);
            retrograde[body] = flags[i] === '1';
        });

        chart.positions  = positions;
        chart.retrograde = retrograde;
        return chart;
    }

    // Modern layout — birth data plus place metadata.
    if (lines[7] !== undefined && lines[7] !== '') {
        const alt = Number(lines[7]);
        if (Number.isFinite(alt)) chart.altitude = alt;
    }
    if (lines[12]) chart.placeName = lines[12];
    if (lines[13]) chart.country   = lines[13];

    return chart;
}

/**
 * UTC instant of birth as an ISO string, derived from the local clock time and
 * the stored offset.
 */
export function jhdToUtcISO(chart: JhdChart): string {
    const ms = Date.UTC(chart.year, chart.month - 1, chart.day)
             + Math.round((chart.hour - chart.tzHours) * 3600_000);
    return new Date(ms).toISOString();
}
