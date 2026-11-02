import { StatCard } from '../ui/StatCard';
import { DataTable, type DataColumn } from '../ui/DataTable';

type Props = {
    matching: {
        sampleNote?: string;
        ashtaKuta?: { total?: number; max?: number; kutas?: Record<string, number> };
        dashaKuta?: { score?: number };
        porutham?: { matched?: number; total?: number };
        mangalDosha?: { boy?: boolean; girl?: boolean } | null;
    };
};

export function MatchingPanel({ matching }: Props) {
    const kutas = matching.ashtaKuta?.kutas ? Object.entries(matching.ashtaKuta.kutas) : [];

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
                    value={
                        matching.ashtaKuta?.total != null
                            ? `${matching.ashtaKuta.total} / ${matching.ashtaKuta.max ?? 36}`
                            : '—'
                    }
                />
                <StatCard label="Dasha kuta" value={String(matching.dashaKuta?.score ?? '—')} />
                <StatCard
                    label="Porutham"
                    value={
                        matching.porutham
                            ? `${matching.porutham.matched ?? '—'} / ${matching.porutham.total ?? '—'}`
                            : '—'
                    }
                />
            </div>
            {kutas.length > 0 && (
                <div className="card">
                    <h3>Kuta breakdown</h3>
                    <DataTable
                        columns={kutaColumns}
                        rows={kutas.map(([name, score]) => ({ name, score }))}
                        rowKey={(r) => r.name}
                        compact
                    />
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
