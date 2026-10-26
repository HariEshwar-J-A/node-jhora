import type { JhdVariant } from './types.js';

/** True when lines 9–17 look like nine sidereal longitudes and line 18 is retrograde flags. */
export function detectJhdVariant(lines: string[]): JhdVariant {
    const tail = lines.slice(8, 17);
    const flags = lines[17] ?? '';

    const looksLegacy =
        tail.length === 9 &&
        tail.every(
            (l) => l !== '' && Number.isFinite(Number(l)) && Number(l) >= 0 && Number(l) < 360,
        ) &&
        /^[01]{9}$/.test(flags);

    return looksLegacy ? 'legacy' : 'modern';
}
