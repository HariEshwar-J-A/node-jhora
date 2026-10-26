import { EphemerisEngine } from '@node-jhora/core';
import { CHART_SECTION_IDS, ChartSession } from '@node-jhora/engine';
import { DateTime } from 'luxon';

/** Canonical warm-chart fixture (Chennai reference instant). */
export const BENCH_CHART = {
    instant: DateTime.fromISO('2000-01-01T12:00:00', { zone: 'Asia/Kolkata' }),
    location: { latitude: 13.0827, longitude: 80.2707 },
    settings: 'node-jhora-default' as const,
    dasha: { depth: 3 },
};

/**
 * Full chart workload: D1–D60 vargas, Vimshottari dasha to level 3, shadbala,
 * yogas, ashtakavarga, plus core sections.
 */
export function runFullChartWarm(engine: EphemerisEngine): void {
    const session = new ChartSession({
        ...BENCH_CHART,
        ephemeris: engine,
    });
    session.collect([...CHART_SECTION_IDS]);
}
