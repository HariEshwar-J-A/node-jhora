import { DateTime } from 'luxon';

/** Format an ISO UTC instant in the chart's resolved IANA zone. */
export function formatInstantLocal(
    iso: string | undefined,
    zone: string,
    style: 'time' | 'datetime' = 'datetime',
): string {
    if (!iso) return '—';
    const dt = DateTime.fromISO(iso, { zone: 'utc' }).setZone(zone);
    if (!dt.isValid) return iso;
    return style === 'time' ? dt.toFormat('HH:mm:ss') : dt.toFormat('yyyy-MM-dd HH:mm:ss');
}

export function formatInstantLocalWithZone(iso: string | undefined, zone: string): string {
    if (!iso) return '—';
    const local = formatInstantLocal(iso, zone, 'datetime');
    return `${local} (${zone})`;
}
