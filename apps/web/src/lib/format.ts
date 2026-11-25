import { DateTime } from 'luxon';
import { tEn, type Translate } from '../i18n/core';
import { KERNEL_DATE_MAX, KERNEL_DATE_MIN } from './constants';

/** Which birth field a parse failure belongs to (for inline form errors). */
export type BirthField = 'date' | 'time' | 'timezone';

/**
 * Accept IANA zones (e.g. Asia/Kolkata) or fixed UTC offsets (+05:30, UTC-4, -0330).
 * Returns a Luxon zone name suitable for {@link DateTime#setZone}.
 */
export function resolveTimezone(
    input: string,
    t: Translate = tEn,
): { ok: true; zone: string } | { ok: false; message: string; field: BirthField } {
    const raw = input.trim();
    if (!raw) {
        return { ok: false, message: t('err.tzRequired'), field: 'timezone' };
    }

    if (/^utc/i.test(raw)) {
        const probe = DateTime.now().setZone(raw);
        if (probe.isValid) return { ok: true, zone: raw };
    }

    if (/^[+-]/.test(raw)) {
        const m = raw.match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/);
        if (!m) {
            return { ok: false, message: t('err.offsetFormat', { raw }), field: 'timezone' };
        }
        const zone = `UTC${m[1]}${Number(m[2])}:${(m[3] ?? '00').padStart(2, '0')}`;
        const probe = DateTime.now().setZone(zone);
        if (!probe.isValid) {
            return { ok: false, message: t('err.offsetInvalid', { raw }), field: 'timezone' };
        }
        return { ok: true, zone };
    }

    const probe = DateTime.now().setZone(raw);
    if (!probe.isValid) {
        return { ok: false, message: t('err.zoneUnknown', { raw }), field: 'timezone' };
    }
    return { ok: true, zone: raw };
}

export function parseBirthInstant(
    date: string,
    time: string,
    timezone: string,
    t: Translate = tEn,
): { ok: true; dt: DateTime; zone: string } | { ok: false; message: string; field: BirthField } {
    const tz = resolveTimezone(timezone, t);
    if (!tz.ok) return tz;
    const dt = DateTime.fromISO(`${date}T${time}`, { zone: tz.zone });
    if (!dt.isValid) {
        // Luxon's explanation is English-only; keep it for English, translate otherwise.
        const message =
            t === tEn && dt.invalidExplanation ? dt.invalidExplanation : t('err.dateTimeInvalid');
        return {
            ok: false,
            message,
            field: /time/i.test(dt.invalidReason ?? '') ? 'time' : 'date',
        };
    }
    const min = DateTime.fromISO(`${KERNEL_DATE_MIN}T00:00:00`, { zone: 'utc' });
    const max = DateTime.fromISO(`${KERNEL_DATE_MAX}T23:59:59`, { zone: 'utc' });
    const utc = dt.toUTC();
    if (utc < min || utc > max) {
        return {
            ok: false,
            message: t('err.outOfRange', { min: KERNEL_DATE_MIN, max: KERNEL_DATE_MAX }),
            field: 'date',
        };
    }
    return { ok: true, dt, zone: tz.zone };
}

export function formatDms(deg: number): string {
    const n = ((deg % 360) + 360) % 360;
    const d = Math.floor(n);
    const mFloat = (n - d) * 60;
    const m = Math.floor(mFloat);
    const s = (mFloat - m) * 60;
    return `${d}° ${m}' ${s.toFixed(2)}"`;
}

export const SIGN_NAMES = [
    'Aries',
    'Taurus',
    'Gemini',
    'Cancer',
    'Leo',
    'Virgo',
    'Libra',
    'Scorpio',
    'Sagittarius',
    'Capricorn',
    'Aquarius',
    'Pisces',
];
