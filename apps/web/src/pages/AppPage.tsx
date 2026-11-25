import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useI18n } from '../i18n';
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

const TABS: TabId[] = [
    'chart',
    'vargas',
    'dashas',
    'panchanga',
    'strength',
    'kp',
    'matching',
    'transits',
    'import',
];

function initialStore() {
    const stored = readProfileStore();
    const active =
        stored.profiles.find((profile) => profile.id === stored.activeId) ?? stored.profiles[0]!;
    return { profiles: stored.profiles, activeId: active.id, draft: active };
}

export function AppPage() {
    const boot = useMemo(initialStore, []);
    const { lang, t } = useI18n();
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
    const kernelTask = useRef<Promise<void> | null>(null);
    const kernelAttempt = useRef(-1);

    const startKernel = useCallback(() => {
        if (kernelAttempt.current !== initAttempt) {
            kernelAttempt.current = initAttempt;
            kernelTask.current = null;
        }
        if (kernelTask.current) return kernelTask.current;
        const task = initEphemeris(new URL(EPHE_PATH, window.location.href).href, (next) => {
            setProgress(next);
        })
            .then(() => {
                setKernelReady(true);
            })
            .catch((err: unknown) => {
                kernelTask.current = null;
                setError(String(err));
                throw err;
            });
        kernelTask.current = task;
        return task;
    }, [initAttempt]);

    useEffect(() => {
        writeProfileStore(
            profiles.map((profile) =>
                profile.id === activeId ? { ...draft, id: profile.id } : profile,
            ),
            activeId,
        );
    }, [profiles, activeId, draft]);

    useEffect(() => {
        setKernelReady(false);
        setError(undefined);
        let cancelled = false;
        const kick = () => {
            if (cancelled) return;
            // The worker script is small. The 32 MB kernel starts on this same
            // idle, or immediately if Calculate runs first.
            getWorker();
            void startKernel().catch(() => {});
        };
        let idleId = 0;
        let timer = 0;
        if (typeof window.requestIdleCallback === 'function') {
            idleId = window.requestIdleCallback(kick, { timeout: 1200 });
        } else {
            timer = window.setTimeout(kick, 200);
        }
        return () => {
            cancelled = true;
            if (idleId) window.cancelIdleCallback?.(idleId);
            if (timer) window.clearTimeout(timer);
        };
    }, [startKernel]);

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
            const errors = validateBirth(source, t);
            setFieldErrors(errors);
            if (Object.keys(errors).length) {
                setError(t('app.fixFields'));
                setSheetOpen(true);
                return;
            }
            setError(undefined);
            const parsed = parseBirthInstant(source.date, source.time, source.timezone, t);
            if (!parsed.ok) {
                setError(parsed.message);
                return;
            }
            setLoading(true);
            try {
                await startKernel();
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
        [settingsFor, startKernel, t],
    );

    // Re-word any visible field errors when the language changes.
    const draftRef = useRef(draft);
    draftRef.current = draft;
    useEffect(() => {
        setFieldErrors((prev) =>
            Object.keys(prev).length ? validateBirth(draftRef.current, t) : prev,
        );
    }, [t]);

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
            title: vargaTitle(1, lang),
            subtitle: labelAyanamsa(draft.ayanamsa, lang),
            dateLabel: `${draft.date} ${draft.time} (${draft.timezone})`,
            place: draft.place || `${draft.latitude}°, ${draft.longitude}°`,
        }),
        [draft, lang],
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
                    name: draft.name.trim() || t('common.untitled'),
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
                    name: t('common.profileCopy', {
                        name: draft.name.trim() || t('common.profile'),
                    }),
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
                    <h2>{t('app.birthData')}</h2>
                    <button
                        type="button"
                        className="btn btn-outline birth-sheet-close"
                        data-testid="birth-sheet-close"
                        onClick={() => setSheetOpen(false)}
                    >
                        {t('common.close')}
                    </button>
                </div>
                <p className="birth-panel__range">
                    {t('app.range', { min: KERNEL_DATE_MIN, max: KERNEL_DATE_MAX })}
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
                                {t('app.retryKernel')}
                            </button>
                        )}
                    </p>
                )}
            </aside>
            {sheetOpen && (
                <button
                    type="button"
                    className="birth-sheet-backdrop"
                    aria-label={t('app.closeBirthData')}
                    onClick={() => setSheetOpen(false)}
                />
            )}

            <div className="app-main">
                <button
                    type="button"
                    className="birth-chip"
                    data-testid="birth-summary-chip"
                    onClick={() => setSheetOpen(true)}
                >
                    {birthSummary(draft, t('app.chartFallback'))}
                </button>
                <div className="tabs" role="tablist">
                    {TABS.map((id) => (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            data-testid={`tab-${id}`}
                            className={`tab ${tab === id ? 'active' : ''}`}
                            onClick={() => setTab(id)}
                        >
                            {t(`app.tab.${id}`)}
                        </button>
                    ))}
                </div>

                <ErrorBoundary title={t('app.panelFailed')}>
                    <AnimatedTabPanel tabKey={tab}>
                        {!result && tab !== 'import' && tab !== 'matching' && (
                            <div className="card">
                                <p>{t('app.emptyHint')}</p>
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
                                riseSetNote={t('app.riseSetNote')}
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
                                    await startKernel();
                                    const ephemerisUrl = new URL(EPHE_PATH, window.location.href)
                                        .href;
                                    const toInput = (source: BirthDraft) => {
                                        const parsed = parseBirthInstant(
                                            source.date,
                                            source.time,
                                            source.timezone,
                                            t,
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
            </div>
        </div>
    );
}
