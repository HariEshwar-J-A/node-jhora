import { useRef, useState } from 'react';
import { BirthDataForm } from '../BirthDataForm';
import { DataTable, type DataColumn } from '../ui/DataTable';
import { useI18n, type Lang, type MessageKey, type Translate } from '../../i18n';
import { kutaName } from '../../i18n/astro';
import {
    createProfileId,
    draftFromUnknown,
    sampleDraft,
    validateBirth,
    type BirthDraft,
    type BirthFieldErrors,
    type BirthProfile,
} from '../../lib/birth';

export type KutaRow = {
    name: string;
    score: number;
    maxScore: number;
    description?: string;
};

export type MatchView = {
    totalScore: number;
    maxScore: number;
    kutas: KutaRow[];
    doshas: Dosha[];
    porutham?: { score: number; max: number };
};

/** Structured so the UI can word each dosha in the chosen language. */
export type Dosha =
    | { kind: 'kuta'; kuta: string; description?: string }
    | { kind: 'rajju'; description?: string }
    | { kind: 'mangal'; a: boolean; b: boolean; status?: string };

const GRADES = new Set(['Good', 'Bad', 'Excellent', 'Passable']);

/** Engine kuta descriptions are short grades; anything else stays as sent. */
function gradeText(description: string | undefined, t: Translate): string | undefined {
    if (!description) return undefined;
    return GRADES.has(description) ? t(`match.grade.${description}` as MessageKey) : description;
}

export function doshaText(
    dosha: Dosha,
    lang: Lang,
    t: Translate,
): { name: string; detail: string } {
    if (dosha.kind === 'kuta') {
        return {
            name: t('match.doshaName', { name: kutaName(dosha.kuta, lang) }),
            detail: gradeText(dosha.description, t) ?? t('match.scoreZero'),
        };
    }
    if (dosha.kind === 'rajju') {
        return {
            name: t('match.rajjuDosha'),
            detail: gradeText(dosha.description, t) ?? t('match.sameRajju'),
        };
    }
    const statusKey = ['Cancel', 'Present', 'None'].includes(dosha.status ?? '')
        ? (`match.status.${dosha.status}` as MessageKey)
        : 'match.status.unknown';
    return {
        name: t('match.mangalDosha'),
        detail: t('match.mangalDetail', {
            a: dosha.a ? t('match.present') : t('match.absent'),
            b: dosha.b ? t('match.present') : t('match.absent'),
            status:
                dosha.status && statusKey === 'match.status.unknown' ? dosha.status : t(statusKey),
        }),
    };
}

export function matchViewFromWorker(rawUnknown: unknown): MatchView {
    const raw = (rawUnknown && typeof rawUnknown === 'object' ? rawUnknown : {}) as {
        ashtaKuta?: {
            totalScore?: number;
            maxScore?: number;
            matches?: KutaRow[];
        };
        porutham?: {
            totalScore?: number;
            maxTotal?: number;
            matches?: KutaRow[];
        };
        mangalDosha?: {
            boyHasDosha?: boolean;
            girlHasDosha?: boolean;
            matchStatus?: string;
        } | null;
    };
    const kutas = raw.ashtaKuta?.matches ?? [];
    const doshas: Dosha[] = [];
    for (const kuta of kutas) {
        if (kuta.score === 0 && (kuta.name === 'Nadi' || kuta.name === 'Bhakoot')) {
            doshas.push({
                kind: 'kuta',
                kuta: kuta.name,
                description: kuta.description || undefined,
            });
        }
    }
    const rajju = raw.porutham?.matches?.find((row) => row.name === 'Rajju');
    if (rajju && rajju.score === 0) {
        doshas.push({ kind: 'rajju', description: rajju.description || undefined });
    }
    if (raw.mangalDosha) {
        doshas.push({
            kind: 'mangal',
            a: Boolean(raw.mangalDosha.boyHasDosha),
            b: Boolean(raw.mangalDosha.girlHasDosha),
            status: raw.mangalDosha.matchStatus,
        });
    }
    return {
        totalScore: raw.ashtaKuta?.totalScore ?? 0,
        maxScore: raw.ashtaKuta?.maxScore ?? 36,
        kutas,
        doshas,
        porutham: raw.porutham
            ? {
                  score: raw.porutham.totalScore ?? 0,
                  max: raw.porutham.maxTotal ?? 0,
              }
            : undefined,
    };
}

type Props = {
    current: BirthDraft;
    profiles: BirthProfile[];
    kernelReady: boolean;
    onMatch: (a: BirthDraft, b: BirthDraft) => Promise<MatchView>;
};

const PERSON_B: BirthDraft = {
    ...sampleDraft(),
    name: 'Mumbai sample',
    date: '1995-06-15',
    time: '08:30',
    place: 'Mumbai, Maharashtra, India',
    latitude: '19.076',
    longitude: '72.877',
};

function ScoreDial({ score, max }: { score: number; max: number }) {
    const { t } = useI18n();
    const radius = 42;
    const circ = 2 * Math.PI * radius;
    const frac = max > 0 ? Math.max(0, Math.min(1, score / max)) : 0;
    return (
        <svg
            className="score-dial"
            viewBox="0 0 120 120"
            role="img"
            aria-label={t('match.scoreOf', { score, max })}
        >
            <circle className="score-dial__track" cx="60" cy="60" r={radius} />
            <circle
                className="score-dial__value"
                cx="60"
                cy="60"
                r={radius}
                strokeDasharray={`${circ * frac} ${circ}`}
                transform="rotate(-90 60 60)"
            />
            <text x="60" y="56" textAnchor="middle" className="score-dial__score">
                {score}
            </text>
            <text x="60" y="74" textAnchor="middle" className="score-dial__max">
                / {max}
            </text>
        </svg>
    );
}

export function MatchingPanel({ current, profiles, kernelReady, onMatch }: Props) {
    const [personA, setPersonA] = useState<BirthDraft>(current);
    const [personB, setPersonB] = useState<BirthDraft>(PERSON_B);
    const [activeA, setActiveA] = useState<string | null>(profiles[0]?.id ?? null);
    const [activeB, setActiveB] = useState<string | null>(null);
    const [localProfiles, setLocalProfiles] = useState<BirthProfile[]>(profiles);
    const [errorsA, setErrorsA] = useState<BirthFieldErrors>({});
    const [errorsB, setErrorsB] = useState<BirthFieldErrors>({});
    const [result, setResult] = useState<MatchView | null>(null);
    const [error, setError] = useState<string>();
    const [busy, setBusy] = useState(false);
    const fileA = useRef<HTMLInputElement>(null);
    const fileB = useRef<HTMLInputElement>(null);
    const { lang, t } = useI18n();

    function patch(which: 'a' | 'b', next: Partial<BirthDraft>) {
        const apply = which === 'a' ? setPersonA : setPersonB;
        apply((prev) => ({ ...prev, ...next }));
    }

    function remember(draft: BirthDraft, which: 'a' | 'b') {
        const id = createProfileId();
        const profile = { ...draft, id, name: draft.name.trim() || t('common.untitled') };
        setLocalProfiles((prev) => [...prev, profile]);
        if (which === 'a') setActiveA(id);
        else setActiveB(id);
    }

    async function run() {
        const aErr = validateBirth(personA, t);
        const bErr = validateBirth(personB, t);
        setErrorsA(aErr);
        setErrorsB(bErr);
        if (Object.keys(aErr).length || Object.keys(bErr).length) {
            setError(t('match.fixFields'));
            return;
        }
        setBusy(true);
        setError(undefined);
        try {
            setResult(await onMatch(personA, personB));
        } catch (err) {
            setError(String(err));
        } finally {
            setBusy(false);
        }
    }

    async function importJson(which: 'a' | 'b', file: File | undefined) {
        if (!file) return;
        try {
            const draft = draftFromUnknown(JSON.parse(await file.text()));
            if (!draft) {
                setError(t('match.notProfile'));
                return;
            }
            if (which === 'a') setPersonA(draft);
            else setPersonB(draft);
            setError(undefined);
        } catch {
            setError(t('match.readFail'));
        }
    }

    const columns: DataColumn<KutaRow>[] = [
        { key: 'name', header: t('match.kuta'), render: (row) => kutaName(row.name, lang) },
        {
            key: 'score',
            header: t('match.obtained'),
            className: 'mono',
            render: (row) => String(row.score),
        },
        {
            key: 'max',
            header: t('match.max'),
            className: 'mono',
            render: (row) => String(row.maxScore),
        },
    ];

    const formProps = (which: 'a' | 'b') => {
        const draft = which === 'a' ? personA : personB;
        const activeId = which === 'a' ? activeA : activeB;
        return {
            draft,
            onChange: (patchDraft: Partial<BirthDraft>) => patch(which, patchDraft),
            profiles: localProfiles,
            activeId,
            onSelectProfile: (id: string) => {
                const profile = localProfiles.find((item) => item.id === id);
                if (!profile) return;
                if (which === 'a') {
                    setActiveA(id);
                    setPersonA(profile);
                } else {
                    setActiveB(id);
                    setPersonB(profile);
                }
            },
            onAdd: () => remember(draft, which),
            onRename: () => {
                if (!activeId) return;
                setLocalProfiles((prev) =>
                    prev.map((item) =>
                        item.id === activeId ? { ...item, ...draft, id: item.id } : item,
                    ),
                );
            },
            onDuplicate: () =>
                remember(
                    {
                        ...draft,
                        name: t('common.profileCopy', {
                            name: draft.name.trim() || t('common.profile'),
                        }),
                    },
                    which,
                ),
            onDelete: () => {
                setLocalProfiles((prev) => prev.filter((item) => item.id !== activeId));
                if (which === 'a') setActiveA(null);
                else setActiveB(null);
            },
            errors: which === 'a' ? errorsA : errorsB,
            idPrefix: which === 'a' ? 'a-' : 'b-',
            placeTestId: which === 'a' ? 'place-input-a' : 'place-input-b',
        };
    };

    return (
        <div className="matching-panel" data-testid="panel-matching">
            <div className="match-actions">
                <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setPersonA(current)}
                >
                    {t('match.aFromCurrent')}
                </button>
                <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setPersonB(current)}
                >
                    {t('match.bFromCurrent')}
                </button>
                <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => fileA.current?.click()}
                >
                    {t('match.importA')}
                </button>
                <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => fileB.current?.click()}
                >
                    {t('match.importB')}
                </button>
                <input
                    ref={fileA}
                    hidden
                    type="file"
                    accept="application/json,.json"
                    aria-label={t('match.importAriaA')}
                    onChange={(event) => {
                        void importJson('a', event.target.files?.[0]);
                        event.target.value = '';
                    }}
                />
                <input
                    ref={fileB}
                    hidden
                    type="file"
                    accept="application/json,.json"
                    aria-label={t('match.importAriaB')}
                    onChange={(event) => {
                        void importJson('b', event.target.files?.[0]);
                        event.target.value = '';
                    }}
                />
            </div>
            <div className="match-pair">
                <section className="card">
                    <h3>{t('match.personA')}</h3>
                    <BirthDataForm {...formProps('a')} />
                </section>
                <section className="card">
                    <h3>{t('match.personB')}</h3>
                    <BirthDataForm {...formProps('b')} />
                </section>
            </div>
            <div className="match-run">
                <button
                    type="button"
                    className="btn btn-default"
                    data-testid="match-btn"
                    disabled={busy || !kernelReady}
                    onClick={() => void run()}
                >
                    {busy ? t('match.running') : t('match.run')}
                </button>
                {error && (
                    <p role="alert" className="form-error">
                        {error}
                    </p>
                )}
            </div>
            {result && (
                <div className="card match-result" data-testid="match-result">
                    <div className="match-result__head">
                        <ScoreDial score={result.totalScore} max={result.maxScore} />
                        <div>
                            <h3>{t('match.ashtakoota')}</h3>
                            <p>
                                {t('match.scoreOf', {
                                    score: result.totalScore,
                                    max: result.maxScore,
                                })}
                                {result.porutham
                                    ? ` · ${t('match.porutham', {
                                          score: result.porutham.score,
                                          max: result.porutham.max,
                                      })}`
                                    : ''}
                            </p>
                        </div>
                    </div>
                    <DataTable
                        columns={columns}
                        rows={result.kutas}
                        rowKey={(row) => row.name}
                        compact
                    />
                    <h3>{t('match.doshas')}</h3>
                    {result.doshas.length === 0 ? (
                        <p>{t('match.noDosha')}</p>
                    ) : (
                        <ul className="match-doshas">
                            {result.doshas.map((dosha) => {
                                const text = doshaText(dosha, lang, t);
                                return (
                                    <li key={dosha.kind === 'kuta' ? dosha.kuta : dosha.kind}>
                                        <strong>{text.name}</strong> — {text.detail}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
