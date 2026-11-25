import { BarChart } from '../ui/BarChart';
import { DataTable, type DataColumn } from '../ui/DataTable';
import { useI18n } from '../../i18n';
import { planetName, yogaRuleName } from '../../i18n/astro';

type ShadbalaRow = {
    planetName: string;
    rupas: number;
    virupas?: number;
};

type YogaHit = {
    key?: string;
    name: string;
    category?: string;
};

function parseShadbalaBars(input: unknown): { label: string; value: number }[] {
    if (Array.isArray(input)) {
        return (input as ShadbalaRow[])
            .map((row) => ({
                label: row.planetName,
                value: typeof row.rupas === 'number' ? row.rupas : 0,
            }))
            .filter((b) => b.label);
    }
    if (input && typeof input === 'object') {
        return Object.entries(input as Record<string, { total?: number } | number>)
            .map(([label, v]) => ({
                label,
                value: typeof v === 'number' ? v : (v.total ?? 0),
            }))
            .filter((b) => b.value > 0);
    }
    return [];
}

function yogaStatusRows(
    yogas: unknown,
): { id: string; key?: string; name: string; present: boolean }[] {
    const hits = Array.isArray(yogas) ? (yogas as YogaHit[]) : [];
    const rows = hits.map((h, i) => ({
        id: h.key ?? String(i),
        key: h.key,
        name: h.name,
        present: true,
    }));
    const gajaPresent = hits.some(
        (h) => h.key === 'GAJA_KESARI' || h.key === 'gaja_kesari' || /gaja\s*kesari/i.test(h.name),
    );
    if (!rows.some((r) => /gaja\s*kesari/i.test(r.name))) {
        rows.unshift({
            id: 'gaja_kesari',
            key: 'GAJA_KESARI',
            name: 'Gaja Kesari Yoga',
            present: gajaPresent,
        });
    }
    return rows;
}

type Props = {
    shadbala: Record<string, { total?: number } | number> | unknown;
    ashtakavarga: { sav?: number[]; bav?: Record<string, number[]> } | unknown;
    yogas: { name: string; active?: boolean }[] | unknown;
};

export function StrengthPanel({ shadbala, ashtakavarga, yogas }: Props) {
    const { lang, t, num } = useI18n();
    const shadbalaBars = parseShadbalaBars(shadbala).map((bar) => ({
        ...bar,
        label: planetName(bar.label, lang),
    }));

    const shadbalaTableRows = Array.isArray(shadbala)
        ? (shadbala as ShadbalaRow[]).map((row, i) => ({
              id: String(i),
              planet: row.planetName,
              rupas: row.rupas,
          }))
        : [];

    const sav =
        ashtakavarga &&
        typeof ashtakavarga === 'object' &&
        Array.isArray((ashtakavarga as { sav?: number[] }).sav)
            ? (ashtakavarga as { sav: number[] }).sav
            : [];

    const yogaRows = yogaStatusRows(yogas);

    const shadbalaColumns: DataColumn<(typeof shadbalaTableRows)[0]>[] = [
        { key: 'planet', header: t('strength.planet'), render: (r) => planetName(r.planet, lang) },
        {
            key: 'rupas',
            header: t('strength.rupas'),
            className: 'mono',
            render: (r) => num(r.rupas, 2),
        },
    ];

    const yogaColumns: DataColumn<(typeof yogaRows)[0]>[] = [
        { key: 'name', header: t('strength.yoga'), render: (r) => yogaRuleName(r, lang) },
        {
            key: 'status',
            header: t('strength.status'),
            render: (r) => (r.present ? t('strength.present') : t('strength.absent')),
        },
    ];

    return (
        <div className="strength-panel" data-testid="panel-strength">
            <div className="card">
                <h3>{t('strength.shadbala')}</h3>
                {shadbalaBars.length ? (
                    <>
                        <BarChart bars={shadbalaBars} unit={t('strength.rupaUnit')} />
                        {shadbalaTableRows.length > 0 && (
                            <DataTable
                                columns={shadbalaColumns}
                                rows={shadbalaTableRows}
                                rowKey={(r) => r.id}
                                compact
                            />
                        )}
                    </>
                ) : (
                    <p>{t('strength.noShadbala')}</p>
                )}
            </div>
            <div className="card">
                <h3>{t('strength.sav')}</h3>
                {sav.length === 12 ? (
                    <div className="sav-grid" role="grid" aria-label={t('strength.savAria')}>
                        {sav.map((pts, i) => (
                            <div key={i} className="sav-grid__cell" role="gridcell">
                                <span className="sav-grid__sign">
                                    {t('strength.signN', { n: i + 1 })}
                                </span>
                                <span className="sav-grid__pts mono">{pts}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p>{t('strength.savNone')}</p>
                )}
            </div>
            <div className="card">
                <h3>{t('strength.yogas')}</h3>
                <DataTable columns={yogaColumns} rows={yogaRows} rowKey={(r) => r.id} compact />
            </div>
        </div>
    );
}
