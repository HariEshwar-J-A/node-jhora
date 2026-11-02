import { BarChart } from '../ui/BarChart';
import { DataTable, type DataColumn } from '../ui/DataTable';

type Props = {
    shadbala: Record<string, { total?: number } | number> | unknown;
    ashtakavarga: { sav?: number[]; bav?: Record<string, number[]> } | unknown;
    yogas: { name: string; active?: boolean }[] | unknown;
};

export function StrengthPanel({ shadbala, ashtakavarga, yogas }: Props) {
    const shadbalaBars =
        shadbala && typeof shadbala === 'object'
            ? Object.entries(shadbala as Record<string, { total?: number } | number>)
                  .map(([label, v]) => ({
                      label,
                      value: typeof v === 'number' ? v : (v.total ?? 0),
                  }))
                  .filter((b) => b.value > 0)
            : [];

    const sav =
        ashtakavarga &&
        typeof ashtakavarga === 'object' &&
        Array.isArray((ashtakavarga as { sav?: number[] }).sav)
            ? (ashtakavarga as { sav: number[] }).sav
            : [];

    const yogaRows = Array.isArray(yogas)
        ? yogas.map((y, i) => ({
              id: String(i),
              name: typeof y === 'object' && y && 'name' in y ? String(y.name) : String(y),
              status: typeof y === 'object' && y && 'active' in y && y.active ? 'Present' : '—',
          }))
        : [];

    const yogaColumns: DataColumn<(typeof yogaRows)[0]>[] = [
        { key: 'name', header: 'Yoga', render: (r) => r.name },
        { key: 'status', header: 'Status', render: (r) => r.status },
    ];

    return (
        <div className="strength-panel" data-testid="panel-strength">
            <div className="card">
                <h3>Shadbala (totals)</h3>
                {shadbalaBars.length ? (
                    <BarChart bars={shadbalaBars} unit="rupa" />
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
                                <span className="sav-grid__sign">{i + 1}</span>
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
