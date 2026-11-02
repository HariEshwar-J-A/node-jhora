import { DataTable, type DataColumn } from '../ui/DataTable';
import { Timeline, type TimelineNode } from '../ui/Timeline';

type DashaPeriod = {
    planet: string;
    start: string;
    end: string;
    subPeriods?: DashaPeriod[];
};

type Props = {
    vimshottari: DashaPeriod[];
    others: Record<string, DashaPeriod[] | unknown>;
    depth: number;
    karakas: unknown;
};

function toTimeline(periods: DashaPeriod[], now = Date.now()): TimelineNode[] {
    return periods.map((p, i) => {
        const start = new Date(p.start).getTime();
        const end = new Date(p.end).getTime();
        const active = now >= start && now <= end;
        return {
            id: `${p.planet}-${i}`,
            title: p.planet,
            subtitle: `${String(p.start).slice(0, 10)} → ${String(p.end).slice(0, 10)}`,
            active,
            children: p.subPeriods?.length ? toTimeline(p.subPeriods, now) : undefined,
        };
    });
}

function flattenDashaTable(
    periods: DashaPeriod[],
    level = 0,
): { level: number; row: DashaPeriod }[] {
    const out: { level: number; row: DashaPeriod }[] = [];
    for (const p of periods) {
        out.push({ level, row: p });
        if (p.subPeriods?.length) {
            out.push(...flattenDashaTable(p.subPeriods, level + 1));
        }
    }
    return out;
}

export function DashasPanel({ vimshottari, others, depth, karakas }: Props) {
    const timeline = toTimeline(Array.isArray(vimshottari) ? vimshottari : []);
    const flat = flattenDashaTable(Array.isArray(vimshottari) ? vimshottari : []);

    const columns: DataColumn<{ level: number; row: DashaPeriod }>[] = [
        {
            key: 'lord',
            header: 'Lord',
            render: ({ level, row }) => (
                <span style={{ paddingLeft: `${level * 0.75}rem` }}>{row.planet}</span>
            ),
        },
        {
            key: 'start',
            header: 'Start',
            className: 'mono',
            render: ({ row }) => String(row.start).slice(0, 19),
        },
        {
            key: 'end',
            header: 'End',
            className: 'mono',
            render: ({ row }) => String(row.end).slice(0, 19),
        },
    ];

    const otherEntries = Object.entries(others).filter(
        ([k, v]) => k !== 'vimshottari' && Array.isArray(v) && v.length,
    );

    return (
        <div className="dashas-panel" data-testid="panel-dashas">
            <div className="card">
                <h3>Vimshottari (depth {depth})</h3>
                <Timeline nodes={timeline} />
                <DataTable
                    columns={columns}
                    rows={flat.slice(0, 80)}
                    rowKey={(r) => `${r.row.planet}-${r.row.start}`}
                    compact
                />
            </div>
            {otherEntries.map(([name, tree]) => (
                <div className="card" key={name}>
                    <h3>{name.replace(/([A-Z])/g, ' $1').trim()}</h3>
                    <DataTable
                        columns={columns}
                        rows={flattenDashaTable(tree as DashaPeriod[]).slice(0, 40)}
                        rowKey={(r) => `${name}-${r.row.planet}-${r.row.start}`}
                        compact
                    />
                </div>
            ))}
            {karakas && typeof karakas === 'object' ? (
                <div className="card">
                    <h3>Jaimini chara karakas</h3>
                    <DataTable
                        columns={[
                            { key: 'k', header: 'Karaka', render: (r) => r.key },
                            { key: 'p', header: 'Planet', render: (r) => r.planet },
                        ]}
                        rows={Object.entries(karakas as Record<string, string>).map(
                            ([key, planet]) => ({
                                key,
                                planet: String(planet),
                            }),
                        )}
                        rowKey={(r) => r.key}
                        compact
                    />
                </div>
            ) : null}
        </div>
    );
}
