import { useRef, useState } from 'react';
import { BirthDataForm } from '../BirthDataForm';
import { DataTable, type DataColumn } from '../ui/DataTable';
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
    doshas: { name: string; detail: string }[];
    porutham?: { score: number; max: number };
};

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
    const doshas: { name: string; detail: string }[] = [];
    for (const kuta of kutas) {
        if (kuta.score === 0 && (kuta.name === 'Nadi' || kuta.name === 'Bhakoot')) {
            doshas.push({
                name: `${kuta.name} dosha`,
                detail: kuta.description || 'Score is 0.',
            });
        }
    }
    const rajju = raw.porutham?.matches?.find((row) => row.name === 'Rajju');
    if (rajju && rajju.score === 0) {
        doshas.push({ name: 'Rajju dosha', detail: rajju.description || 'Same rajju.' });
    }
    if (raw.mangalDosha) {
        const boy = raw.mangalDosha.boyHasDosha ? 'present' : 'absent';
        const girl = raw.mangalDosha.girlHasDosha ? 'present' : 'absent';
        doshas.push({
            name: 'Mangal dosha',
            detail: `Person A ${boy}, Person B ${girl} (${raw.mangalDosha.matchStatus ?? 'unknown'}).`,
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
    const radius = 42;
    const circ = 2 * Math.PI * radius;
    const frac = max > 0 ? Math.max(0, Math.min(1, score / max)) : 0;
    return (
        <svg
            className="score-dial"
            viewBox="0 0 120 120"
            role="img"
            aria-label={`${score} of ${max}`}
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

    function patch(which: 'a' | 'b', next: Partial<BirthDraft>) {
        const apply = which === 'a' ? setPersonA : setPersonB;
        apply((prev) => ({ ...prev, ...next }));
    }

    function remember(draft: BirthDraft, which: 'a' | 'b') {
        const id = createProfileId();
        const profile = { ...draft, id, name: draft.name.trim() || 'Untitled' };
        setLocalProfiles((prev) => [...prev, profile]);
        if (which === 'a') setActiveA(id);
        else setActiveB(id);
    }

    async function run() {
        const aErr = validateBirth(personA);
        const bErr = validateBirth(personB);
        setErrorsA(aErr);
        setErrorsB(bErr);
        if (Object.keys(aErr).length || Object.keys(bErr).length) {
            setError('Fix the highlighted fields before matching.');
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
                setError('That JSON is not a birth profile.');
                return;
            }
            if (which === 'a') setPersonA(draft);
            else setPersonB(draft);
            setError(undefined);
        } catch {
            setError('Could not read that JSON file.');
        }
    }

    const columns: DataColumn<KutaRow>[] = [
        { key: 'name', header: 'Kuta', render: (row) => row.name },
        {
            key: 'score',
            header: 'Obtained',
            className: 'mono',
            render: (row) => String(row.score),
        },
        {
            key: 'max',
            header: 'Max',
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
                remember({ ...draft, name: `${draft.name.trim() || 'Profile'} copy` }, which),
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
                    Person A from current chart
                </button>
                <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => setPersonB(current)}
                >
                    Person B from current chart
                </button>
                <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => fileA.current?.click()}
                >
                    Import JSON for A
                </button>
                <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => fileB.current?.click()}
                >
                    Import JSON for B
                </button>
                <input
                    ref={fileA}
                    hidden
                    type="file"
                    accept="application/json,.json"
                    aria-label="Import person A JSON"
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
                    aria-label="Import person B JSON"
                    onChange={(event) => {
                        void importJson('b', event.target.files?.[0]);
                        event.target.value = '';
                    }}
                />
            </div>
            <div className="match-pair">
                <section className="card">
                    <h3>Person A</h3>
                    <BirthDataForm {...formProps('a')} />
                </section>
                <section className="card">
                    <h3>Person B</h3>
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
                    {busy ? 'Matching…' : 'Match'}
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
                            <h3>Ashtakoota</h3>
                            <p>
                                {result.totalScore} of {result.maxScore}
                                {result.porutham
                                    ? ` · Porutham ${result.porutham.score} / ${result.porutham.max}`
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
                    <h3>Doshas</h3>
                    {result.doshas.length === 0 ? (
                        <p>No dosha flagged in this pair.</p>
                    ) : (
                        <ul className="match-doshas">
                            {result.doshas.map((dosha) => (
                                <li key={dosha.name}>
                                    <strong>{dosha.name}</strong> — {dosha.detail}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
}
