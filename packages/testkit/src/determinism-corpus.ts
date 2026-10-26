/** One birth chart input for the determinism corpus (no engine dependency). */
export interface DeterminismCorpusCase {
    readonly id: string;
    /** UTC instant with trailing `Z`. */
    readonly instant: string;
    readonly timezone: string;
    readonly latitude: number;
    readonly longitude: number;
    readonly altitude?: number;
    /** Preset id or settings object accepted by {@link ChartSession}. */
    readonly settings: string;
}

/**
 * Fixed chart inputs exercised by `pnpm run check:determinism`.
 * Values are independent of host TZ or locale.
 */
export const DETERMINISM_CORPUS: readonly DeterminismCorpusCase[] = [
    {
        id: 'chennai-jhora-default',
        instant: '2000-01-01T12:00:00.000Z',
        timezone: 'Asia/Kolkata',
        latitude: 13.0827,
        longitude: 80.2707,
        settings: 'node-jhora-default',
    },
    {
        id: 'chennai-jhora-8',
        instant: '2000-01-01T12:00:00.000Z',
        timezone: 'Asia/Kolkata',
        latitude: 13.0827,
        longitude: 80.2707,
        settings: 'jhora-default@8.0',
    },
    {
        id: 'utc-kp-2000-equinox',
        instant: '2000-03-20T12:00:00.000Z',
        timezone: 'UTC',
        latitude: 0,
        longitude: 0,
        settings: 'kp',
    },
    {
        id: 'reykjavik-lahiri-1985',
        instant: '1985-06-21T18:30:00.000Z',
        timezone: 'Atlantic/Reykjavik',
        latitude: 64.1466,
        longitude: -21.9426,
        settings: 'lahiri-mean',
    },
    {
        id: 'sydney-raman-2012',
        instant: '2012-12-21T05:11:00.000Z',
        timezone: 'Australia/Sydney',
        latitude: -33.8688,
        longitude: 151.2093,
        settings: 'raman',
    },
] as const;
