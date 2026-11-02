import { DataTable, type DataColumn } from '../ui/DataTable';
import { SIGN_NAMES } from '../../lib/format';

type MercuryRow = {
    id: string;
    type: string;
    from: string;
    to: string;
    when: string;
};

type Props = {
    transits: {
        mercuryTransits?: MercuryRow[] | Record<string, unknown>;
        marsIngress?: { instant?: string; targetSign?: number } | null;
    };
};

function normalizeMercury(raw: Props['transits']['mercuryTransits']): MercuryRow[] {
    if (!raw) return [];
    const list = Array.isArray(raw) ? raw : Object.values(raw);
    return list
        .filter((e): e is Record<string, unknown> => e != null && typeof e === 'object')
        .map((e, i) => ({
            id: String(e.instant ?? i),
            type: String(e.type ?? 'Event'),
            from: e.prevSign != null ? (SIGN_NAMES[Number(e.prevSign)] ?? String(e.prevSign)) : '—',
            to: e.newSign != null ? (SIGN_NAMES[Number(e.newSign)] ?? String(e.newSign)) : '—',
            when: String(e.instant ?? '—'),
        }));
}

export function TransitsPanel({ transits }: Props) {
    const mercury = normalizeMercury(transits.mercuryTransits);

    const columns: DataColumn<MercuryRow>[] = [
        { key: 'type', header: 'Event', render: (r) => r.type },
        { key: 'from', header: 'From', render: (r) => r.from },
        { key: 'to', header: 'To', render: (r) => r.to },
        { key: 'when', header: 'Time (UTC)', className: 'mono', render: (r) => r.when },
    ];

    return (
        <div className="transits-panel" data-testid="panel-transits">
            <div className="card">
                <h3>Mercury transits (30 days)</h3>
                {mercury.length ? (
                    <DataTable columns={columns} rows={mercury} rowKey={(r) => r.id} />
                ) : (
                    <p>No Mercury ingress events in this window.</p>
                )}
            </div>
            {transits.marsIngress?.instant && (
                <div className="card">
                    <h3>Mars ingress (Aries)</h3>
                    <p className="mono">{transits.marsIngress.instant}</p>
                </div>
            )}
        </div>
    );
}
