import type { KPSignificator } from '@node-jhora/core';
import { DataTable, type DataColumn } from '../ui/DataTable';

type PlanetSig = KPSignificator & { planetName: string };
type HouseSig = KPSignificator & { houseNumber: number };

const LORD_NAMES: Record<number, string> = {
    0: 'Sun',
    1: 'Moon',
    2: 'Mercury',
    3: 'Venus',
    4: 'Mars',
    5: 'Jupiter',
    6: 'Saturn',
    10: 'Rahu',
    11: 'Uranus',
    12: 'Neptune',
    13: 'Pluto',
    99: 'Ketu',
};

function lordName(id: number): string {
    return LORD_NAMES[id] ?? `Body ${id}`;
}

function formatSig(s: KPSignificator): string {
    return `${lordName(s.starLord)} · ${lordName(s.subLord)} · ${lordName(s.subSubLord)}`;
}

type Props = {
    kp: {
        planets?: PlanetSig[];
        houses?: HouseSig[];
    };
};

export function KpPanel({ kp }: Props) {
    const planetCols: DataColumn<PlanetSig>[] = [
        { key: 'p', header: 'Planet', render: (r) => r.planetName },
        { key: 's', header: 'Significators', render: (r) => formatSig(r) },
    ];

    const houseCols: DataColumn<HouseSig>[] = [
        { key: 'h', header: 'House', render: (r) => String(r.houseNumber) },
        { key: 's', header: 'Significators', render: (r) => formatSig(r) },
    ];

    return (
        <div className="kp-panel" data-testid="panel-kp">
            <div className="card">
                <h3>KP planet significators</h3>
                <DataTable
                    columns={planetCols}
                    rows={kp.planets ?? []}
                    rowKey={(r) => r.planetName}
                    compact
                />
            </div>
            <div className="card">
                <h3>KP house cusps</h3>
                <DataTable
                    columns={houseCols}
                    rows={kp.houses ?? []}
                    rowKey={(r) => String(r.houseNumber)}
                    compact
                />
            </div>
        </div>
    );
}
