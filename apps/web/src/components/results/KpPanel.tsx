import type { KPSignificator } from '@node-jhora/core';
import { DataTable, type DataColumn } from '../ui/DataTable';
import { useI18n, type Lang, type Translate } from '../../i18n';
import { planetName } from '../../i18n/astro';

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
    7: 'Rahu',
    8: 'Ketu',
    10: 'Rahu',
    11: 'Uranus',
    12: 'Neptune',
    13: 'Pluto',
    99: 'Ketu',
};

function lordName(id: number, lang: Lang, t: Translate): string {
    const name = LORD_NAMES[id];
    return name ? planetName(name, lang) : t('kp.body', { id });
}

function formatSig(s: KPSignificator, lang: Lang, t: Translate): string {
    return [s.starLord, s.subLord, s.subSubLord].map((id) => lordName(id, lang, t)).join(' · ');
}

type Props = {
    kp: {
        planets?: PlanetSig[];
        houses?: HouseSig[];
    };
};

export function KpPanel({ kp }: Props) {
    const { lang, t } = useI18n();
    const planetCols: DataColumn<PlanetSig>[] = [
        { key: 'p', header: t('kp.planet'), render: (r) => planetName(r.planetName, lang) },
        { key: 's', header: t('kp.significators'), render: (r) => formatSig(r, lang, t) },
    ];

    const houseCols: DataColumn<HouseSig>[] = [
        { key: 'h', header: t('kp.house'), render: (r) => String(r.houseNumber) },
        { key: 's', header: t('kp.significators'), render: (r) => formatSig(r, lang, t) },
    ];

    return (
        <div className="kp-panel" data-testid="panel-kp">
            <div className="card">
                <h3>{t('kp.planetsTitle')}</h3>
                <DataTable
                    columns={planetCols}
                    rows={kp.planets ?? []}
                    rowKey={(r) => r.planetName}
                    compact
                />
            </div>
            <div className="card">
                <h3>{t('kp.housesTitle')}</h3>
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
