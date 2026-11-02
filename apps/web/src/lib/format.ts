import { DateTime } from 'luxon';
import { KERNEL_DATE_MAX, KERNEL_DATE_MIN } from './constants';

export function parseBirthInstant(
    date: string,
    time: string,
    timezone: string,
): { ok: true; dt: DateTime } | { ok: false; message: string } {
    const dt = DateTime.fromISO(`${date}T${time}`, { zone: timezone });
    if (!dt.isValid) {
        return { ok: false, message: dt.invalidExplanation ?? 'Invalid date or time' };
    }
    const min = DateTime.fromISO(`${KERNEL_DATE_MIN}T00:00:00`, { zone: 'utc' });
    const max = DateTime.fromISO(`${KERNEL_DATE_MAX}T23:59:59`, { zone: 'utc' });
    const utc = dt.toUTC();
    if (utc < min || utc > max) {
        return {
            ok: false,
            message: `Date must fall within ephemeris range ${KERNEL_DATE_MIN} … ${KERNEL_DATE_MAX} (DE440s).`,
        };
    }
    return { ok: true, dt };
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
