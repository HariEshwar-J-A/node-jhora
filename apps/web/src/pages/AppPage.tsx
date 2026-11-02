import { useCallback, useEffect, useMemo, useState } from 'react';
import { getPreset, type SettingsInput } from '@node-jhora/core';
import { VargaBoard } from '../components/chart/VargaBoard';
import { labelAyanamsa } from '../lib/chart-labels';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AnimatedTabPanel } from '../components/AnimatedTabPanel';
import { BirthDataForm } from '../components/BirthDataForm';
import { DashasPanel } from '../components/results/DashasPanel';
import { ImportExportPanel } from '../components/results/ImportExportPanel';
import { KpPanel } from '../components/results/KpPanel';
import { MatchingPanel, matchViewFromWorker } from '../components/results/MatchingPanel';
import { PanchangaPanel } from '../components/results/PanchangaPanel';
import { PlanetsPanel } from '../components/results/PlanetsPanel';
import { StrengthPanel } from '../components/results/StrengthPanel';
import { TransitsPanel } from '../components/results/TransitsPanel';
import { vargaTitle } from '../lib/astro-display';
import {
    birthSummary,
    createProfileId,
    readProfileStore,
    validateBirth,
    writeProfileStore,
    type BirthDraft,
    type BirthFieldErrors,
    type BirthProfile,
} from '../lib/birth';
import { EPHE_PATH, KERNEL_DATE_MAX, KERNEL_DATE_MIN } from '../lib/constants';
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

function initialStore() {
    const stored = readProfileStore();
    const active =
        stored.profiles.find((profile) => profile.id === stored.activeId) ?? stored.profiles[0]!;
    return { profiles: stored.profiles, activeId: active.id, draft: active };
}

export function AppPage() {
    const boot = useMemo(initialStore, []);
    const [tab, setTab] = useState<TabId>('chart');
    const [profiles, setProfiles] = useState<BirthProfile[]>(boot.profiles);
    const [activeId, setActiveId] = useState(boot.activeId);
    const [draft, setDraft] = useState<BirthDraft>(boot.draft);
    const [fieldErrors, setFieldErrors] = useState<BirthFieldErrors>({});
    const [sheetOpen, setSheetOpen] = useState(false);
    const [kernelReady, setKernelReady] = useState(false);
    const [progress, setProgress] = useState<InitProgress>({ phase: 'checking-cache' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | undefined>();
    const [result, setResult] = useState<any>();
    const [initAttempt, setInitAttempt] = useState(0);

    useEffect(() => {
        writeProfileStore(
            profiles.map((profile) =>
                profile.id === activeId ? { ...draft, id: profile.id } : profile,
            ),
            activeId,
        );
    }, [profiles, activeId, draft]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                setError(undefined);
                setKernelReady(false);
                await initEphemeris(new URL(EPHE_PATH, window.location.href).href, (next) => {
                    if (!cancelled) setProgress(next);
                });
                if (!cancelled) setKernelReady(true);
            } catch (err) {
                if (!cancelled) setError(String(err));
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [initAttempt]);

    const settingsFor = useCallback((source: BirthDraft): SettingsInput => {
        const base = getPreset('node-jhora-default');
        return {
            ...base,
            ayanamsa: source.ayanamsa,
            houseSystem: source.houseSystem,
            nodeType: source.nodeType,
        };
    }, []);

    const computeFrom = useCallback(
        async (source: BirthDraft) => {
            const errors = validateBirth(source);
            setFieldErrors(errors);
            if (Object.keys(errors).length) {
                setError('Fix the highlighted fields.');
                setSheetOpen(true);
                return;
            }
            setError(undefined);
            const parsed = parseBirthInstant(source.date, source.time, source.timezone);
            if (!parsed.ok) {
                setError(parsed.message);
                return;
            }
            setLoading(true);
            try {
                const custom = source.customVarga.trim() ? Number(source.customVarga) : undefined;
                const data = await getWorker().computeFull({
                    instantIso: parsed.dt.toUTC().toISO()!,
                    latitude: Number(source.latitude),
                    longitude: Number(source.longitude),
                    settings: settingsFor(source),
                    houseSystem: source.houseSystem,
                    ephemerisUrl: new URL(EPHE_PATH, window.location.href).href,
                    timezone: parsed.zone,
                    customVarga: custom,
                    dashaDepth: 1,
                });
                setResult(data);
                setSheetOpen(false);
            } catch (err) {
                setError(String(err));
            } finally {
                setLoading(false);
            }
        },
        [settingsFor],
    );

    const progressPct =
        progress.totalBytes && progress.loadedBytes
            ? Math.min(100, (100 * progress.loadedBytes) / progress.totalBytes)
            : progress.phase === 'ready'
              ? 100
              : 0;

    const planets = result?.snapshot?.planets ?? [];
    const houses = result?.snapshot?.houses;
    const chartMeta: ChartMeta = useMemo(
        () => ({
            title: vargaTitle(1),
            subtitle: labelAyanamsa(draft.ayanamsa),
            dateLabel: `${draft.date} ${draft.time} (${draft.timezone})`,
            place: draft.place || `${draft.latitude}°, ${draft.longitude}°`,
        }),
        [draft],
    );

    function selectProfile(id: string) {
        const profile = profiles.find((item) => item.id === id);
        if (!profile) return;
        setActiveId(id);
        setDraft(profile);
        setFieldErrors({});
        if (kernelReady) void computeFrom(profile);
    }

    const form = (
        <BirthDataForm
            draft={draft}
            onChange={(patch) => setDraft((prev) => ({ ...prev, ...patch }))}
            profiles={profiles}
            activeId={activeId}
            onSelectProfile={selectProfile}
            onAdd={() => {
                const created: BirthProfile = {
                    ...draft,
                    id: createProfileId(),
                    name: draft.name.trim() || 'Untitled',
                };
                setProfiles((prev) => [...prev, created]);
                setActiveId(created.id);
                setDraft(created);
            }}
            onRename={() => {
                setProfiles((prev) =>
                    prev.map((profile) =>
                        profile.id === activeId ? { ...draft, id: profile.id } : profile,
                    ),
                );
            }}
            onDuplicate={() => {
                const copy: BirthProfile = {
                    ...draft,
                    id: createProfileId(),
                    name: `${draft.name.trim() || 'Profile'} copy`,
                };
                setProfiles((prev) => [...prev, copy]);
                setActiveId(copy.id);
                setDraft(copy);
            }}
            onDelete={() => {
                const rest = profiles.filter((profile) => profile.id !== activeId);
                const next = rest[0];
                setProfiles(rest.length ? rest : profiles);
                if (next) selectProfile(next.id);
            }}
            errors={fieldErrors}
            showSubmit
            onSubmit={() => void computeFrom(draft)}
            loading={loading}
            kernelReady={kernelReady}
            progress={{ phase: progress.phase, percent: progressPct }}
        />
    );

    return (
        <div className="app-layout">
            <aside className={`card birth-panel${sheetOpen ? ' birth-panel--open' : ''}`}>
                <div className="birth-panel__head">
                    <h2>Birth data</h2>
                    <button
                        type="button"
                        className="btn btn-outline birth-sheet-close"
                        data-testid="birth-sheet-close"
                        onClick={() => setSheetOpen(false)}
                    >
                        Close
                    </button>
                </div>
                <p className="birth-panel__range">
                    Saved on this device. Supported range: {KERNEL_DATE_MIN} – {KERNEL_DATE_MAX}.
                </p>
                {form}
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
            {sheetOpen && (
                <button
                    type="button"
                    className="birth-sheet-backdrop"
                    aria-label="Close birth data"
                    onClick={() => setSheetOpen(false)}
                />
            )}

            <main>
                <button
                    type="button"
                    className="birth-chip"
                    data-testid="birth-summary-chip"
                    onClick={() => setSheetOpen(true)}
                >
                    {birthSummary(draft)}
                </button>
                <div className="tabs" role="tablist">
                    {TABS.map((item) => (
                        <button
                            key={item.id}
                            type="button"
                            role="tab"
                            data-testid={`tab-${item.id}`}
                            className={`tab ${tab === item.id ? 'active' : ''}`}
                            onClick={() => setTab(item.id)}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>

                <ErrorBoundary title="This panel failed to render">
                    <AnimatedTabPanel tabKey={tab}>
                        {!result && tab !== 'import' && tab !== 'matching' && (
                            <div className="card">
                                <p>
                                    Load the ephemeris kernel, enter birth data, and run Calculate.
                                    Sample: fictional Chennai, 2000-01-01 12:00 Asia/Kolkata.
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
                                depth={1}
                                timeZone={result.meta?.resolvedZone ?? draft.timezone}
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

                        {tab === 'matching' && (
                            <MatchingPanel
                                current={draft}
                                profiles={profiles}
                                kernelReady={kernelReady}
                                onMatch={async (a, b) => {
                                    const ephemerisUrl = new URL(EPHE_PATH, window.location.href)
                                        .href;
                                    const toInput = (source: BirthDraft) => {
                                        const parsed = parseBirthInstant(
                                            source.date,
                                            source.time,
                                            source.timezone,
                                        );
                                        if (!parsed.ok) throw new Error(parsed.message);
                                        return {
                                            instantIso: parsed.dt.toUTC().toISO()!,
                                            latitude: Number(source.latitude),
                                            longitude: Number(source.longitude),
                                            settings: settingsFor(source),
                                            houseSystem: source.houseSystem,
                                            ephemerisUrl,
                                            timezone: parsed.zone,
                                        };
                                    };
                                    const raw = await getWorker().matchPair(toInput(a), toInput(b));
                                    return matchViewFromWorker(raw);
                                }}
                            />
                        )}

                        {result && tab === 'transits' && (
                            <TransitsPanel
                                transits={result.transits ?? {}}
                                timeZone={result.meta?.resolvedZone ?? draft.timezone}
                            />
                        )}

                        {tab === 'import' && <ImportExportPanel />}
                    </AnimatedTabPanel>
                </ErrorBoundary>
            </main>
        </div>
    );
}
