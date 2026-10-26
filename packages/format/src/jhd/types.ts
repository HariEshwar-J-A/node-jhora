/** Bodies in the order observed in legacy `.jhd` position blocks. */
export const JHD_BODY_ORDER = [
    'Sun',
    'Moon',
    'Mars',
    'Mercury',
    'Jupiter',
    'Venus',
    'Saturn',
    'Rahu',
    'Lagna',
] as const;

export type JhdBody = (typeof JHD_BODY_ORDER)[number];

export type JhdVariant = 'legacy' | 'modern';

/**
 * How to interpret line 8 when the file is the modern layout.
 *
 * Legacy files use line 8 for an unrelated scalar (often a small fraction such as
 * `0.975635`); it is **not** elevation. Modern files store altitude on line 8.
 * Observed modern exports use **kilometres**; some analysis notes treat the same
 * field as **metres** — use `metres` or `kilometres` to force either reading.
 */
export type JhdLine8AltitudeMode = 'auto' | 'kilometres' | 'metres' | 'ignore';

export interface JhdParseOptions {
    /** @default 'auto' */
    line8Altitude?: JhdLine8AltitudeMode;
}

export interface JhdChart {
    year: number;
    month: number;
    day: number;
    /** Local clock time, decimal hours. */
    hour: number;
    /** Offset east of UTC, decimal hours (+5.5 for India). */
    tzHours: number;
    /** Degrees east, decimal (negative = west). */
    longitude: number;
    /** Degrees north, decimal (negative = south). */
    latitude: number;
    /** Metres above sea level when recorded (modern layout). */
    altitudeMetres?: number;
    /** Raw numeric line 8 before altitude interpretation. */
    line8Raw?: number;
    placeName?: string;
    country?: string;
    positions?: Record<JhdBody, number>;
    retrograde?: Partial<Record<JhdBody, boolean>>;
}

export interface JhdFileMeta {
    variant: JhdVariant;
    /** How line 8 was interpreted for `altitudeMetres`. */
    line8AltitudeApplied: JhdLine8AltitudeMode | 'legacy-ignored';
    /** Original lines (trimmed), for lossless round-trip when provided to the writer. */
    rawLines?: string[];
}

export interface JhdParseResult {
    chart: JhdChart;
    meta: JhdFileMeta;
}

export interface JhdWriteOptions {
    /** Line ending; JHora uses CRLF. @default '\r\n' */
    eol?: string;
    /**
     * When set, re-emits the exact body from a prior parse (lossless round-trip).
     * Otherwise writes a canonical encoding for the chart shape.
     */
    meta?: JhdFileMeta;
}
