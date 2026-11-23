import { DataTable, type DataColumn } from '../ui/DataTable';
import { nakshatraName, signName } from '../../lib/astro-display';
import { formatInstantLocalWithZone } from '../../lib/local-time-display';

type MercuryRow = {
    id: string;
    type: string;
    from: string;
    to: string;
    when: string;
};

type Props = {
    timeZone: string;
    transits: {
        mercuryTransits?: MercuryRow[] | Record<string, unknown>;
        marsIngress?: { instant?: string; targetSign?: number } | null;
    };
};

function formatTransitEndpoint(eventType: string, value: number | undefined | null): string {
    if (value == null || !Number.isFinite(Number(value))) return '—';
    const v = Number(value);
    if (eventType === 'Nakshatra') return nakshatraName(v);
    return signName(v + 1);
}

function normalizeMercury(raw: Props['transits']['mercuryTransits'], zone: string): MercuryRow[] {
    if (!raw) return [];
    const list = Array.isArray(raw) ? raw : Object.values(raw);
    return list
        .filter((e): e is Record<string, unknown> => e != null && typeof e === 'object')
        .map((e, i) => {
            const eventType = String(e.type ?? 'Sign');
            const prev = e.prevValue ?? e.prevSign;
            const next = e.newValue ?? e.newSign;
            return {
                id: String(e.instant ?? i),
                type: eventType,
                from: formatTransitEndpoint(eventType, prev as number),
                to: formatTransitEndpoint(eventType, next as number),
                when:
                    e.instant != null && String(e.instant)
                        ? formatInstantLocalWithZone(String(e.instant), zone)
                        : '—',
            };
        });
}

export function TransitsPanel({ transits, timeZone }: Props) {
    const mercury = normalizeMercury(transits.mercuryTransits, timeZone);

    const columns: DataColumn<MercuryRow>[] = [
        { key: 'type', header: 'Event', render: (r) => r.type },
        { key: 'from', header: 'From', render: (r) => r.from },
        { key: 'to', header: 'To', render: (r) => r.to },
        { key: 'when', header: `Time (${timeZone})`, className: 'mono', render: (r) => r.when },
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
                    <p className="mono">
                        {formatInstantLocalWithZone(transits.marsIngress.instant, timeZone)}
                    </p>
                </div>
            )}
        </div>
    );
}
