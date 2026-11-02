import { BarChart } from '../ui/BarChart';
import { DataTable, type DataColumn } from '../ui/DataTable';

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

function yogaStatusRows(yogas: unknown): { id: string; name: string; status: string }[] {
    const hits = Array.isArray(yogas) ? (yogas as YogaHit[]) : [];
    const rows = hits.map((h, i) => ({
        id: h.key ?? String(i),
        name: h.name,
        status: 'Present',
    }));
    const gajaPresent = hits.some(
        (h) => h.key === 'GAJA_KESARI' || h.key === 'gaja_kesari' || /gaja\s*kesari/i.test(h.name),
    );
    if (!rows.some((r) => /gaja\s*kesari/i.test(r.name))) {
        rows.unshift({
            id: 'gaja_kesari',
            name: 'Gaja Kesari Yoga',
            status: gajaPresent ? 'Present' : 'Absent',
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
    const shadbalaBars = parseShadbalaBars(shadbala);

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
        { key: 'planet', header: 'Planet', render: (r) => r.planet },
        {
            key: 'rupas',
            header: 'Rupas',
            className: 'mono',
            render: (r) => r.rupas.toFixed(2),
        },
    ];

    const yogaColumns: DataColumn<(typeof yogaRows)[0]>[] = [
        { key: 'name', header: 'Yoga', render: (r) => r.name },
        { key: 'status', header: 'Status', render: (r) => r.status },
    ];

    return (
        <div className="strength-panel" data-testid="panel-strength">
            <div className="card">
                <h3>Shadbala (totals)</h3>
                {shadbalaBars.length ? (
                    <>
                        <BarChart bars={shadbalaBars} unit="rupa" />
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
                    <p>No shadbala totals in this snapshot.</p>
                )}
            </div>
            <div className="card">
                <h3>Ashtakavarga (SAV)</h3>
                {sav.length === 12 ? (
                    <div className="sav-grid" role="grid" aria-label="Sarvashtakavarga">
                        {sav.map((pts, i) => (
                            <div key={i} className="sav-grid__cell" role="gridcell">
                                <span className="sav-grid__sign">Sign {i + 1}</span>
                                <span className="sav-grid__pts mono">{pts}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p>SAV grid not available.</p>
                )}
            </div>
            <div className="card">
                <h3>Yogas</h3>
                <DataTable columns={yogaColumns} rows={yogaRows} rowKey={(r) => r.id} compact />
            </div>
        </div>
    );
}
