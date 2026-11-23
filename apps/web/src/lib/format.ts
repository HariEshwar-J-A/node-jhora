import { DateTime } from 'luxon';
import { KERNEL_DATE_MAX, KERNEL_DATE_MIN } from './constants';

/**
 * Accept IANA zones (e.g. Asia/Kolkata) or fixed UTC offsets (+05:30, UTC-4, -0330).
 * Returns a Luxon zone name suitable for {@link DateTime#setZone}.
 */
export function resolveTimezone(
    input: string,
): { ok: true; zone: string } | { ok: false; message: string } {
    const raw = input.trim();
    if (!raw) {
        return { ok: false, message: 'Time zone is required.' };
    }

    if (/^utc/i.test(raw)) {
        const probe = DateTime.now().setZone(raw);
        if (probe.isValid) return { ok: true, zone: raw };
    }

    if (/^[+-]/.test(raw)) {
        const m = raw.match(/^([+-])(\d{1,2})(?::?(\d{2}))?$/);
        if (!m) {
            return {
                ok: false,
                message: `Invalid UTC offset "${raw}". Use forms like +05:30 or -04:00.`,
            };
        }
        const zone = `UTC${m[1]}${Number(m[2])}:${(m[3] ?? '00').padStart(2, '0')}`;
        const probe = DateTime.now().setZone(zone);
        if (!probe.isValid) {
            return { ok: false, message: `Invalid UTC offset "${raw}".` };
        }
        return { ok: true, zone };
    }

    const probe = DateTime.now().setZone(raw);
    if (!probe.isValid) {
        return {
            ok: false,
            message: `Unknown time zone "${raw}". Use an IANA name (Asia/Kolkata) or offset (+05:30).`,
        };
    }
    return { ok: true, zone: raw };
}

export function parseBirthInstant(
    date: string,
    time: string,
    timezone: string,
): { ok: true; dt: DateTime; zone: string } | { ok: false; message: string } {
    const tz = resolveTimezone(timezone);
    if (!tz.ok) return tz;
    const dt = DateTime.fromISO(`${date}T${time}`, { zone: tz.zone });
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
