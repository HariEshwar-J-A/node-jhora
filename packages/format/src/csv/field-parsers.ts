// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

import { DateTime } from 'luxon';

import { isValidIanaTimeZone } from '../iana.js';
import type { LocalClock } from '../schema.js';

export interface ParsedDate {
    year: number;
    month: number;
    day: number;
}

export interface ParsedTime {
    hour: number;
    minute: number;
    second: number;
    millisecond?: number;
}

const DATE_PATTERNS: { re: RegExp; parse: (m: RegExpMatchArray) => ParsedDate }[] = [
    {
        re: /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
        parse: (m) => ({ year: +m[1]!, month: +m[2]!, day: +m[3]! }),
    },
    {
        re: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/,
        parse: (m) => ({ year: +m[1]!, month: +m[2]!, day: +m[3]! }),
    },
    {
        re: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
        parse: (m) => ({ year: +m[3]!, month: +m[1]!, day: +m[2]! }),
    },
    {
        re: /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
        parse: (m) => ({ year: +m[3]!, month: +m[1]!, day: +m[2]! }),
    },
    {
        re: /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/,
        parse: (m) => ({ year: +m[3]!, month: +m[2]!, day: +m[1]! }),
    },
    {
        re: /^(\d{4})(\d{2})(\d{2})$/,
        parse: (m) => ({ year: +m[1]!, month: +m[2]!, day: +m[3]! }),
    },
];

const TIME_PATTERNS: { re: RegExp; parse: (m: RegExpMatchArray) => ParsedTime }[] = [
    {
        re: /^(\d{1,2}):(\d{2}):(\d{2})$/,
        parse: (m) => ({ hour: +m[1]!, minute: +m[2]!, second: +m[3]! }),
    },
    {
        re: /^(\d{1,2}):(\d{2})$/,
        parse: (m) => ({ hour: +m[1]!, minute: +m[2]!, second: 0 }),
    },
    {
        re: /^(\d{1,2})(\d{2})(\d{2})$/,
        parse: (m) => ({ hour: +m[1]!, minute: +m[2]!, second: +m[3]! }),
    },
    {
        re: /^(\d{1,2}):(\d{2}):(\d{2})\.(\d{1,3})$/,
        parse: (m) => ({
            hour: +m[1]!,
            minute: +m[2]!,
            second: +m[3]!,
            millisecond: +m[4]!.padEnd(3, '0').slice(0, 3),
        }),
    },
];

export function parseDateField(raw: string): ParsedDate | undefined {
    const s = raw.trim();
    if (!s) return undefined;
    for (const { re, parse } of DATE_PATTERNS) {
        const m = s.match(re);
        if (m) {
            const d = parse(m);
            const dt = DateTime.fromObject({ year: d.year, month: d.month, day: d.day });
            if (!dt.isValid) return undefined;
            return d;
        }
    }
    const iso = DateTime.fromISO(s, { zone: 'utc' });
    if (iso.isValid && s.includes('-')) {
        return { year: iso.year, month: iso.month, day: iso.day };
    }
    return undefined;
}

export function parseTimeField(raw: string): ParsedTime | undefined {
    const s = raw.trim();
    if (!s) return undefined;
    for (const { re, parse } of TIME_PATTERNS) {
        const m = s.match(re);
        if (m) {
            const t = parse(m);
            if (t.hour < 0 || t.hour > 23 || t.minute > 59 || t.second > 59) return undefined;
            return t;
        }
    }
    return undefined;
}

export function parseCombinedDateTime(
    raw: string,
): { date: ParsedDate; time: ParsedTime } | undefined {
    const s = raw.trim();
    if (!s) return undefined;
    const dt = DateTime.fromISO(s, { setZone: true });
    if (dt.isValid) {
        return {
            date: { year: dt.year, month: dt.month, day: dt.day },
            time: {
                hour: dt.hour,
                minute: dt.minute,
                second: dt.second,
                millisecond: dt.millisecond || undefined,
            },
        };
    }
    const parts = s.split(/[T\s]+/, 2);
    if (parts.length === 2) {
        const date = parseDateField(parts[0]!);
        const time = parseTimeField(parts[1]!);
        if (date && time) return { date, time };
    }
    return undefined;
}

/** Decimal degrees or DMS (various separators). */
export function parseLatitude(raw: string): number | undefined {
    return parseCoordinate(raw, true);
}

export function parseLongitude(raw: string): number | undefined {
    return parseCoordinate(raw, false);
}

function parseCoordinate(raw: string, isLat: boolean): number | undefined {
    const s = raw.trim();
    if (!s) return undefined;
    const asNum = Number(s.replace(/,/g, ''));
    if (Number.isFinite(asNum) && /^-?\d+(\.\d+)?$/.test(s.replace(/,/g, ''))) {
        const limit = isLat ? 90 : 180;
        if (Math.abs(asNum) <= limit) return asNum;
        return undefined;
    }
    const dms = parseDms(s, isLat);
    return dms;
}

const DMS_RE =
    /^([+-]?\d+(?:\.\d+)?)\s*[°dD]\s*(\d+(?:\.\d+)?)?\s*[''′mM]?\s*(\d+(?:\.\d+)?)?\s*["″sS]?/;

function parseDms(s: string, isLat: boolean): number | undefined {
    const m = s.match(DMS_RE);
    if (!m) return undefined;
    const deg = Math.abs(parseFloat(m[1]!));
    const min = m[2] ? parseFloat(m[2]) : 0;
    const sec = m[3] ? parseFloat(m[3]) : 0;
    let value = deg + min / 60 + sec / 3600;
    if (/^[-−]/.test(s) || /[Ss]$/.test(s.trim()) || (isLat && /S/i.test(s))) value = -value;
    else if (!isLat && /W/i.test(s)) value = -value;
    const limit = isLat ? 90 : 180;
    if (value < -limit || value > limit) return undefined;
    return value;
}

/** UTC offset in minutes east of UTC (+05:30 → 330). */
export function parseUtcOffsetMinutes(raw: string): number | undefined {
    const s = raw.trim();
    if (!s) return undefined;
    const compact = s.replace(/\s+/g, '').toUpperCase();
    if (/^[+-]?\d+$/.test(compact) && !compact.includes(':')) {
        const n = parseInt(compact, 10);
        if (Math.abs(n) <= 840) return n;
    }
    const m = compact.match(/^(?:UTC|GMT)?([+-])(\d{1,2})(?::?(\d{2}))?$/);
    if (m) {
        const sign = m[1] === '-' ? -1 : 1;
        const hours = parseInt(m[2]!, 10);
        const mins = m[3] ? parseInt(m[3], 10) : 0;
        return sign * (hours * 60 + mins);
    }
    return undefined;
}

export function parseTimezoneField(raw: string): string | undefined {
    const s = raw.trim();
    if (!s) return undefined;
    if (isValidIanaTimeZone(s)) return s;
    const alias = s.replace(/\s+/g, '_');
    if (isValidIanaTimeZone(alias)) return alias;
    return undefined;
}

export type SexValue = 'female' | 'male' | 'other' | 'unspecified';

export function parseGenderField(raw: string): SexValue | undefined {
    const s = raw.trim().toLowerCase();
    if (!s) return undefined;
    if (['f', 'female', 'woman', 'w'].includes(s)) return 'female';
    if (['m', 'male', 'man'].includes(s)) return 'male';
    if (['o', 'other', 'nonbinary', 'non-binary', 'nb'].includes(s)) return 'other';
    if (['u', 'unspecified', 'unknown', ''].includes(s)) return 'unspecified';
    return undefined;
}

export function toLocalClock(date: ParsedDate, time: ParsedTime): LocalClock {
    return {
        year: date.year,
        month: date.month,
        day: date.day,
        hour: time.hour,
        minute: time.minute,
        second: time.second,
        millisecond: time.millisecond,
    };
}

export function normalizeUtcInstant(dt: DateTime): string {
    const utc = dt.toUTC();
    if (!utc.isValid) throw new Error('invalid UTC instant');
    if (utc.millisecond === 0) {
        return `${utc.toFormat("yyyy-MM-dd'T'HH:mm:ss")}Z`;
    }
    const iso = utc.toISO({ suppressMilliseconds: false, includeOffset: true });
    if (!iso) throw new Error('invalid UTC instant');
    return iso.endsWith('Z') ? iso : `${iso.replace(/([+-]\d{2}:\d{2})$/, '')}Z`;
}

/** Find an IANA zone whose offset at `local` matches `offsetMinutes` (for offset-only imports). */
export function ianaZoneForOffset(offsetMinutes: number, local: LocalClock): string | undefined {
    const probe = DateTime.fromObject(
        {
            year: local.year,
            month: local.month,
            day: local.day,
            hour: local.hour,
            minute: local.minute,
            second: local.second,
        },
        // UTC has no DST gaps, so the probe keeps the exact wall clock whatever the host zone.
        { zone: 'utc' },
    );
    if (!probe.isValid) return undefined;
    const supported =
        typeof Intl !== 'undefined' && 'supportedValuesOf' in Intl
            ? (Intl as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf('timeZone')
            : [];
    for (const tz of supported) {
        const zoned = probe.setZone(tz, { keepLocalTime: true });
        // Skip zones where this wall clock falls in a DST gap: Luxon shifts such
        // times forward, so the offset would describe a different clock reading.
        if (
            zoned.isValid &&
            zoned.offset === offsetMinutes &&
            zoned.hour === local.hour &&
            zoned.minute === local.minute
        ) {
            return tz;
        }
    }
    return undefined;
}
