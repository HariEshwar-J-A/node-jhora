import { useCallback, useEffect, useMemo, useState } from 'react';
import { AYANAMSA_IDS, getPreset, HOUSE_SYSTEM_IDS, type SettingsInput } from '@node-jhora/core';
import { VargaBoard } from '../components/chart/VargaBoard';
import { labelAyanamsa, labelHouseSystem } from '../lib/chart-labels';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AnimatedTabPanel } from '../components/AnimatedTabPanel';
import { DashasPanel } from '../components/results/DashasPanel';
import { ImportExportPanel } from '../components/results/ImportExportPanel';
import { KpPanel } from '../components/results/KpPanel';
import { MatchingPanel } from '../components/results/MatchingPanel';
import { PanchangaPanel } from '../components/results/PanchangaPanel';
import { PlanetsPanel } from '../components/results/PlanetsPanel';
import { StrengthPanel } from '../components/results/StrengthPanel';
import { TransitsPanel } from '../components/results/TransitsPanel';
import { EPHE_PATH, KERNEL_DATE_MAX, KERNEL_DATE_MIN, SAMPLE_CHART } from '../lib/constants';
import { parseBirthInstant } from '../lib/format';
import type { ChartMeta } from '../components/chart/types';
import type { InitProgress } from '../lib/worker-types';
import { getWorker, initEphemeris, resetWorker } from '../lib/worker-client';

type TabId =
    | 'chart'
    | 'vargas'
    | 'dashas'
    | 'panchanga'
    | 'strength'
    | 'kp'
    | 'matching'
    | 'transits'
    | 'import';

const TABS: { id: TabId; label: string }[] = [
    { id: 'chart', label: 'Chart' },
    { id: 'vargas', label: 'Vargas' },
    { id: 'dashas', label: 'Dashas' },
    { id: 'panchanga', label: 'Panchanga' },
    { id: 'strength', label: 'Strength' },
    { id: 'kp', label: 'KP' },
    { id: 'matching', label: 'Matching' },
    { id: 'transits', label: 'Transits' },
    { id: 'import', label: 'Import / export' },
];

export function AppPage() {
    const [tab, setTab] = useState<TabId>('chart');
    const [date, setDate] = useState(SAMPLE_CHART.date);
    const [time, setTime] = useState(SAMPLE_CHART.time);
    const [timezone, setTimezone] = useState(SAMPLE_CHART.timezone);
    const [latitude, setLatitude] = useState(String(SAMPLE_CHART.latitude));
    const [longitude, setLongitude] = useState(String(SAMPLE_CHART.longitude));
    const [ayanamsa, setAyanamsa] = useState<(typeof AYANAMSA_IDS)[number]>('true_citra');
    const [houseSystem, setHouseSystem] = useState<(typeof HOUSE_SYSTEM_IDS)[number]>('whole_sign');
    const [customVarga, setCustomVarga] = useState('');
    const [dashaDepth, setDashaDepth] = useState(3);
    const [kernelReady, setKernelReady] = useState(false);
    const [progress, setProgress] = useState<InitProgress>({ phase: 'checking-cache' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | undefined>();
    const [result, setResult] = useState<any>();

    const [initAttempt, setInitAttempt] = useState(0);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setError(undefined);
                setKernelReady(false);
                await initEphemeris(new URL(EPHE_PATH, window.location.href).href, (p) => {
                    if (!cancelled) setProgress(p);
                });
                if (!cancelled) {
                    setKernelReady(true);
                }
            } catch (e) {
                if (!cancelled) setError(String(e));
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [initAttempt]);

    const settings: SettingsInput = useMemo(() => {
        const base = getPreset('node-jhora-default');
        return {
            ...base,
            ayanamsa,
            houseSystem,
        };
    }, [ayanamsa, houseSystem]);

    const compute = useCallback(async () => {
        setError(undefined);
        const parsed = parseBirthInstant(date, time, timezone);
        if (!parsed.ok) {
            setError(parsed.message);
            return;
        }
        const lat = Number(latitude);
        const lon = Number(longitude);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
            setError('Latitude and longitude must be numbers.');
            return;
        }
        setLoading(true);
        try {
            const instantIso = parsed.dt.toUTC().toISO()!;
            const custom = customVarga.trim() ? Number(customVarga) : undefined;
            const data = await getWorker().computeFull({
                instantIso,
                latitude: lat,
                longitude: lon,
                settings,
                houseSystem,
                ephemerisUrl: new URL(EPHE_PATH, window.location.href).href,
                timezone: parsed.zone,
                customVarga: custom,
                dashaDepth,
            });
            setResult(data);
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    }, [date, time, timezone, latitude, longitude, settings, houseSystem, customVarga, dashaDepth]);

    const planets = result?.snapshot?.planets ?? [];
    const houses = result?.snapshot?.houses;

    const chartMeta: ChartMeta = useMemo(
        () => ({
            title: 'Rashi',
            subtitle: labelAyanamsa(ayanamsa),
            dateLabel: `${date} ${time} (${timezone})`,
            place: `${latitude}°, ${longitude}°`,
        }),
        [ayanamsa, date, time, timezone, latitude, longitude],
    );
    const progressPct =
        progress.totalBytes && progress.loadedBytes
            ? Math.min(100, (100 * progress.loadedBytes) / progress.totalBytes)
            : progress.phase === 'ready'
              ? 100
              : 0;

    return (
        <div className="app-layout">
            <aside className="card">
                <h2>Birth data</h2>
                <p style={{ fontSize: '0.85rem', color: 'hsl(var(--muted-foreground))' }}>
                    Stored locally in this tab only. Supported range: {KERNEL_DATE_MIN} –{' '}
                    {KERNEL_DATE_MAX}.
                </p>
                {!kernelReady && (
                    <div style={{ margin: '1rem 0' }}>
                        <p className="mono">Ephemeris: {progress.phase}</p>
                        <div className="progress" aria-label="Download progress">
                            <span style={{ width: `${progressPct}%` }} />
                        </div>
                    </div>
                )}
                <div className="field-row">
                    <label htmlFor="date">Date</label>
                    <input id="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="field-row">
                    <label htmlFor="time">Time</label>
                    <input id="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
                <div className="field-row">
                    <label htmlFor="tz">
                        Time zone (IANA or offset, e.g. Asia/Kolkata or +05:30)
                    </label>
                    <input id="tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
                </div>
                <div className="field-row">
                    <label htmlFor="lat">Latitude</label>
                    <input
                        id="lat"
                        value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                    />
                </div>
                <div className="field-row">
                    <label htmlFor="lon">Longitude</label>
                    <input
                        id="lon"
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                    />
                </div>
                <div className="field-row">
                    <label htmlFor="ayan">Ayanamsa</label>
                    <select
                        id="ayan"
                        value={ayanamsa}
                        onChange={(e) => setAyanamsa(e.target.value as typeof ayanamsa)}
                    >
                        {AYANAMSA_IDS.map((id) => (
                            <option key={id} value={id}>
                                {labelAyanamsa(id)}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="field-row">
                    <label htmlFor="hs">House system</label>
                    <select
                        id="hs"
                        value={houseSystem}
                        onChange={(e) => setHouseSystem(e.target.value as typeof houseSystem)}
                    >
                        {HOUSE_SYSTEM_IDS.map((id) => (
                            <option key={id} value={id}>
                                {labelHouseSystem(id)}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="field-row">
                    <label htmlFor="cv">Custom varga divisor (optional)</label>
                    <input
                        id="cv"
                        value={customVarga}
                        onChange={(e) => setCustomVarga(e.target.value)}
                        placeholder="e.g. 300"
                    />
                </div>
                <div className="field-row">
                    <label htmlFor="depth">Vimshottari depth (1–5)</label>
                    <input
                        id="depth"
                        type="number"
                        min={1}
                        max={5}
                        value={dashaDepth}
                        onChange={(e) => setDashaDepth(Number(e.target.value))}
                    />
                </div>
                <button
                    type="button"
                    className="btn btn-default"
                    data-testid="calculate-btn"
                    disabled={loading || !kernelReady}
                    onClick={compute}
                >
                    {loading
                        ? 'Calculating…'
                        : kernelReady
                          ? 'Calculate'
                          : 'Calculate (loads ephemeris)'}
                </button>
                {error && (
                    <p role="alert" className="form-error">
                        {error}
                        {!kernelReady && (
                            <button
                                type="button"
                                className="btn btn-outline"
                                style={{ display: 'block', marginTop: '0.5rem' }}
                                onClick={() => {
                                    resetWorker();
                                    setInitAttempt((n) => n + 1);
                                }}
                            >
                                Retry ephemeris load
                            </button>
                        )}
                    </p>
                )}
            </aside>

            <main>
                <div className="tabs" role="tablist">
                    {TABS.map((t) => (
                        <button
                            key={t.id}
                            type="button"
                            role="tab"
                            data-testid={`tab-${t.id}`}
                            className={`tab ${tab === t.id ? 'active' : ''}`}
                            onClick={() => setTab(t.id)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <ErrorBoundary title="This panel failed to render">
                    <AnimatedTabPanel tabKey={tab}>
                        {!result && tab !== 'import' && (
                            <div className="card">
                                <p>
                                    Load the ephemeris kernel, enter birth data, and run Calculate.
                                    Sample: Greenwich noon, 2000-01-01 (fictional reference).
                                </p>
                            </div>
                        )}

                        {result && tab === 'chart' && (
                            <PlanetsPanel
                                ascendant={houses?.ascendant ?? 0}
                                planets={planets}
                                meta={chartMeta}
                            />
                        )}

                        {result && tab === 'vargas' && (
                            <div className="card">
                                <VargaBoard
                                    ascendant={houses?.ascendant ?? 0}
                                    d1Planets={planets}
                                    vargas={result.snapshot.vargas ?? {}}
                                    meta={chartMeta}
                                />
                            </div>
                        )}

                        {result && tab === 'dashas' && (
                            <DashasPanel
                                vimshottari={result.dashas?.vimshottari ?? []}
                                others={result.dashas ?? {}}
                                depth={dashaDepth}
                                karakas={result.karakas}
                            />
                        )}

                        {result && tab === 'panchanga' && (
                            <PanchangaPanel
                                panchanga={result.snapshot.panchanga ?? {}}
                                sunRiseSet={result.sunRiseSet}
                                riseSetNote="Sunrise and sunset for the birth date (local civil day), using the JHora default: geometric disc centre on the horizon without refraction. USNO and NOAA tables use the upper limb with refraction, typically about 4–6 minutes earlier."
                            />
                        )}

                        {result && tab === 'strength' && (
                            <StrengthPanel
                                shadbala={result.snapshot.shadbala}
                                ashtakavarga={result.snapshot.ashtakavarga}
                                yogas={result.snapshot.yogas}
                            />
                        )}

                        {result && tab === 'kp' && <KpPanel kp={result.kp ?? {}} />}

                        {result && tab === 'matching' && (
                            <MatchingPanel matching={result.matching ?? {}} />
                        )}

                        {result && tab === 'transits' && (
                            <TransitsPanel
                                transits={result.transits ?? {}}
                                timeZone={result.meta?.resolvedZone ?? timezone}
                            />
                        )}

                        {tab === 'import' && <ImportExportPanel />}
                    </AnimatedTabPanel>
                </ErrorBoundary>
            </main>
        </div>
    );
}
