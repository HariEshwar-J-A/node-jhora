import { DataTable, type DataColumn } from '../ui/DataTable';
import { useI18n, type Lang, type MessageKey } from '../../i18n';
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

function formatTransitEndpoint(
    eventType: string,
    value: number | undefined | null,
    lang: Lang,
): string {
    if (value == null || !Number.isFinite(Number(value))) return '—';
    const v = Number(value);
    if (eventType === 'Nakshatra') return nakshatraName(v, lang);
    return signName(v + 1, lang);
}

function normalizeMercury(
    raw: Props['transits']['mercuryTransits'],
    zone: string,
    lang: Lang,
): MercuryRow[] {
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
                from: formatTransitEndpoint(eventType, prev as number, lang),
                to: formatTransitEndpoint(eventType, next as number, lang),
                when:
                    e.instant != null && String(e.instant)
                        ? formatInstantLocalWithZone(String(e.instant), zone)
                        : '—',
            };
        });
}

export function TransitsPanel({ transits, timeZone }: Props) {
    const { lang, t } = useI18n();
    const mercury = normalizeMercury(transits.mercuryTransits, timeZone, lang);
    const typeLabel = (type: string) =>
        type === 'Sign' || type === 'Nakshatra' ? t(`transits.type.${type}` as MessageKey) : type;

    const columns: DataColumn<MercuryRow>[] = [
        { key: 'type', header: t('transits.event'), render: (r) => typeLabel(r.type) },
        { key: 'from', header: t('transits.from'), render: (r) => r.from },
        { key: 'to', header: t('transits.to'), render: (r) => r.to },
        {
            key: 'when',
            header: t('transits.time', { zone: timeZone }),
            className: 'mono',
            render: (r) => r.when,
        },
    ];

    return (
        <div className="transits-panel" data-testid="panel-transits">
            <div className="card">
                <h3>{t('transits.mercury')}</h3>
                {mercury.length ? (
                    <DataTable columns={columns} rows={mercury} rowKey={(r) => r.id} />
                ) : (
                    <p>{t('transits.none')}</p>
                )}
            </div>
            {transits.marsIngress?.instant && (
                <div className="card">
                    <h3>{t('transits.mars')}</h3>
                    <p className="mono">
                        {formatInstantLocalWithZone(transits.marsIngress.instant, timeZone)}
                    </p>
                </div>
            )}
        </div>
    );
}
