import type { RiseSetOutcome } from '@node-jhora/core';

export function formatRiseSetOutcome(outcome: RiseSetOutcome | undefined, zone: string): string {
    if (!outcome) return '—';
    if (outcome.kind === 'none') {
        return outcome.reason === 'polar_day' ? 'No set (polar day)' : 'No rise (polar night)';
    }
    return outcome.dateTime.setZone(zone).toFormat('HH:mm:ss');
}
