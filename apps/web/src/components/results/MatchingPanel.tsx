import { StatCard } from '../ui/StatCard';
import { DataTable, type DataColumn } from '../ui/DataTable';

type KutaScoreLike = { name: string; score: number; maxScore?: number };
type MatchBlock = {
    totalScore?: number;
    maxScore?: number;
    total?: number;
    max?: number;
    score?: number;
    kutas?: Record<string, number>;
    matches?: KutaScoreLike[];
};

type PoruthamBlock = {
    totalScore?: number;
    maxTotal?: number;
    matched?: number;
    total?: number;
    matches?: KutaScoreLike[];
};

type Props = {
    matching: {
        sampleNote?: string;
        ashtaKuta?: MatchBlock;
        dashaKuta?: MatchBlock;
        porutham?: PoruthamBlock;
        mangalDosha?: { boy?: boolean; girl?: boolean } | null;
    };
};

function matchTotal(block: MatchBlock | undefined): { score: number | null; max: number | null } {
    if (!block) return { score: null, max: null };
    const score = block.totalScore ?? block.total ?? block.score ?? null;
    const max = block.maxScore ?? block.max ?? null;
    return { score, max };
}

function matchKutaRows(block: MatchBlock | undefined): { name: string; score: number }[] {
    if (!block) return [];
    if (block.matches?.length) {
        return block.matches.map((m) => ({ name: m.name, score: m.score }));
    }
    if (block.kutas) {
        return Object.entries(block.kutas).map(([name, score]) => ({ name, score }));
    }
    return [];
}

export function MatchingPanel({ matching }: Props) {
    const ashta = matchTotal(matching.ashtaKuta);
    const dasha = matchTotal(matching.dashaKuta);
    const poruthamScore = matching.porutham?.totalScore ?? matching.porutham?.matched ?? null;
    const poruthamMax = matching.porutham?.maxTotal ?? matching.porutham?.total ?? null;

    const kutas = matchKutaRows(matching.ashtaKuta);

    const kutaColumns: DataColumn<{ name: string; score: number }>[] = [
        { key: 'name', header: 'Kuta', render: (r) => r.name },
        { key: 'score', header: 'Score', className: 'mono', render: (r) => String(r.score) },
    ];

    return (
        <div className="matching-panel" data-testid="panel-matching">
            {matching.sampleNote ? (
                <p className="matching-panel__note">{matching.sampleNote}</p>
            ) : null}
            <div className="stat-grid">
                <StatCard
                    label="Ashta kuta"
                    value={ashta.score != null ? `${ashta.score} / ${ashta.max ?? 36}` : '—'}
                />
                <StatCard
                    label="Dasha kuta"
                    value={dasha.score != null ? String(dasha.score) : '—'}
                />
                <StatCard
                    label="Porutham"
                    value={poruthamScore != null ? `${poruthamScore} / ${poruthamMax ?? '—'}` : '—'}
                />
            </div>
            {kutas.length > 0 && (
                <div className="card">
                    <h3>Kuta breakdown</h3>
                    <DataTable columns={kutaColumns} rows={kutas} rowKey={(r) => r.name} compact />
                </div>
            )}
            {matching.mangalDosha && (
                <div className="card">
                    <h3>Mangal dosha (demo pair)</h3>
                    <div className="stat-grid">
                        <StatCard
                            label="Boy chart"
                            value={matching.mangalDosha.boy ? 'Present' : 'Absent'}
                        />
                        <StatCard
                            label="Girl chart (offset demo)"
                            value={matching.mangalDosha.girl ? 'Present' : 'Absent'}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
