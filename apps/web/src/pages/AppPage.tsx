import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    AYANAMSA_IDS,
    getPreset,
    HOUSE_SYSTEM_IDS,
    type SettingsInput,
} from '@node-jhora/core';
import { ChartWheel } from '../components/ChartWheel';
import {
    EPHE_PATH,
    KERNEL_DATE_MAX,
    KERNEL_DATE_MIN,
    SAMPLE_CHART,
} from '../lib/constants';
import { formatDms, parseBirthInstant, SIGN_NAMES } from '../lib/format';
import type { InitProgress } from '../lib/worker-types';
import { getWorker, initEphemeris } from '../lib/worker-client';

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
    const [chartStyle, setChartStyle] = useState<'north' | 'south'>('north');
    const [kernelReady, setKernelReady] = useState(false);
    const [progress, setProgress] = useState<InitProgress>({ phase: 'checking-cache' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | undefined>();
    const [result, setResult] = useState<any>();
    const [jhdText, setJhdText] = useState('');
    const [njhText, setNjhText] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
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
    }, []);

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
                timezone,
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
                <p style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                    Stored locally in this tab only. Supported range: {KERNEL_DATE_MIN} – {KERNEL_DATE_MAX}.
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
                    <label htmlFor="tz">Time zone (IANA)</label>
                    <input id="tz" value={timezone} onChange={(e) => setTimezone(e.target.value)} />
                </div>
                <div className="field-row">
                    <label htmlFor="lat">Latitude</label>
                    <input id="lat" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
                </div>
                <div className="field-row">
                    <label htmlFor="lon">Longitude</label>
                    <input id="lon" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
                </div>
                <div className="field-row">
                    <label htmlFor="ayan">Ayanamsa</label>
                    <select id="ayan" value={ayanamsa} onChange={(e) => setAyanamsa(e.target.value as typeof ayanamsa)}>
                        {AYANAMSA_IDS.map((id) => (
                            <option key={id} value={id}>
                                {id}
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
                                {id}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="field-row">
                    <label htmlFor="cv">Custom varga divisor (optional)</label>
                    <input id="cv" value={customVarga} onChange={(e) => setCustomVarga(e.target.value)} placeholder="e.g. 300" />
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
                <button type="button" className="btn btn-primary" disabled={loading} onClick={compute}>
                    {loading ? 'Calculating…' : kernelReady ? 'Calculate' : 'Calculate (loads ephemeris)'}
                </button>
                {error && (
                    <p role="alert" style={{ color: 'var(--accent)', marginTop: '0.75rem' }}>
                        {error}
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
                            className={`tab ${tab === t.id ? 'active' : ''}`}
                            onClick={() => setTab(t.id)}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                {!result && (
                    <div className="card">
                        <p>Load the ephemeris kernel, enter birth data, and run Calculate. Sample: Greenwich noon, 2000-01-01 (fictional reference).</p>
                    </div>
                )}

                {result && tab === 'chart' && (
                    <div className="grid-2">
                        <div className="card">
                            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                <button type="button" className={`tab ${chartStyle === 'north' ? 'active' : ''}`} onClick={() => setChartStyle('north')}>
                                    North Indian
                                </button>
                                <button type="button" className={`tab ${chartStyle === 'south' ? 'active' : ''}`} onClick={() => setChartStyle('south')}>
                                    South Indian
                                </button>
                            </div>
                            <ChartWheel
                                style={chartStyle}
                                ascendant={houses?.ascendant ?? 0}
                                planets={planets}
                            />
                        </div>
                        <div className="card">
                            <h3>Planets (sidereal)</h3>
                            <table className="data">
                                <thead>
                                    <tr>
                                        <th>Body</th>
                                        <th>Sign</th>
                                        <th>Longitude</th>
                                        <th>Speed</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {planets.map((p: any) => (
                                        <tr key={p.name}>
                                            <td>{p.name}</td>
                                            <td>{SIGN_NAMES[p.sign - 1]}</td>
                                            <td className="mono">{formatDms(p.longitude)}</td>
                                            <td className="mono">{p.speed.toFixed(4)}°/d</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {result && tab === 'vargas' && (
                    <div className="card">
                        <h3>Divisional charts</h3>
                        <p className="mono">Session batch: D1–D60 (16 charts). Extra named divisors below.</p>
                        <pre style={{ overflow: 'auto', fontSize: '0.75rem', maxHeight: 420 }}>
                            {JSON.stringify(result.snapshot.vargas, null, 2)}
                        </pre>
                        {result.extraVargas?.length > 0 && (
                            <>
                                <h4>Additional divisors</h4>
                                <pre style={{ overflow: 'auto', fontSize: '0.75rem', maxHeight: 280 }}>
                                    {JSON.stringify(result.extraVargas, null, 2)}
                                </pre>
                            </>
                        )}
                    </div>
                )}

                {result && tab === 'dashas' && (
                    <div className="card">
                        <h3>Dasha systems</h3>
                        <details open>
                            <summary>Vimshottari (depth {dashaDepth})</summary>
                            <pre style={{ overflow: 'auto', fontSize: '0.7rem', maxHeight: 240 }}>
                                {JSON.stringify(result.dashas.vimshottari, null, 2)}
                            </pre>
                        </details>
                        {Object.entries(result.dashas)
                            .filter(([k]) => k !== 'vimshottari')
                            .map(([name, tree]) => (
                                <details key={name}>
                                    <summary>{name}</summary>
                                    <pre style={{ overflow: 'auto', fontSize: '0.7rem', maxHeight: 180 }}>
                                        {JSON.stringify(tree, null, 2)}
                                    </pre>
                                </details>
                            ))}
                        <h4>Jaimini chara karakas</h4>
                        <pre style={{ fontSize: '0.75rem' }}>{JSON.stringify(result.karakas, null, 2)}</pre>
                    </div>
                )}

                {result && tab === 'panchanga' && (
                    <div className="card">
                        <h3>Panchanga</h3>
                        <pre>{JSON.stringify(result.snapshot.panchanga, null, 2)}</pre>
                        <h4>Sun rise / set (DE440s)</h4>
                        <pre>{JSON.stringify(result.sunRiseSet, null, 2)}</pre>
                    </div>
                )}

                {result && tab === 'strength' && (
                    <div className="card">
                        <h3>Shadbala</h3>
                        <pre style={{ fontSize: '0.8rem' }}>{JSON.stringify(result.snapshot.shadbala, null, 2)}</pre>
                        <h3>Ashtakavarga</h3>
                        <pre style={{ fontSize: '0.8rem' }}>{JSON.stringify(result.snapshot.ashtakavarga, null, 2)}</pre>
                        <h3>Yogas (engine library)</h3>
                        <pre style={{ fontSize: '0.8rem' }}>{JSON.stringify(result.snapshot.yogas, null, 2)}</pre>
                    </div>
                )}

                {result && tab === 'kp' && (
                    <div className="card">
                        <pre style={{ fontSize: '0.8rem' }}>{JSON.stringify(result.kp, null, 2)}</pre>
                    </div>
                )}

                {result && tab === 'matching' && (
                    <div className="card">
                        <p>{result.matching.sampleNote}</p>
                        <pre>{JSON.stringify(result.matching, null, 2)}</pre>
                    </div>
                )}

                {result && tab === 'transits' && (
                    <div className="card">
                        <pre>{JSON.stringify(result.transits, null, 2)}</pre>
                    </div>
                )}

                {tab === 'import' && (
                    <div className="card grid-2">
                        <div>
                            <h3>JHD</h3>
                            <textarea rows={8} value={jhdText} onChange={(e) => setJhdText(e.target.value)} />
                            <button
                                type="button"
                                className="btn"
                                onClick={async () => {
                                    try {
                                        const parsed = await getWorker().parseJhdText(jhdText);
                                        setJhdText(await getWorker().writeJhdText(parsed));
                                    } catch (e) {
                                        setError(String(e));
                                    }
                                }}
                            >
                                Parse & round-trip
                            </button>
                        </div>
                        <div>
                            <h3>NJH</h3>
                            <textarea rows={8} value={njhText} onChange={(e) => setNjhText(e.target.value)} />
                            <button
                                type="button"
                                className="btn"
                                onClick={async () => {
                                    try {
                                        const parsed = await getWorker().parseNjhText(njhText);
                                        setNjhText(await getWorker().serializeNjhText(parsed));
                                    } catch (e) {
                                        setError(String(e));
                                    }
                                }}
                            >
                                Parse & serialize
                            </button>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
