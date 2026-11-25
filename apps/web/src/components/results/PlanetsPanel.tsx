import { DataTable, type DataColumn } from '../ui/DataTable';
import { ErrorBoundary } from '../ErrorBoundary';
import { ChartToggle } from '../chart/ChartToggle';
import { ChartView } from '../chart/ChartView';
import type { ChartMeta, ChartPlanet } from '../chart/types';
import { useI18n } from '../../i18n';
import { planetName } from '../../i18n/astro';
import {
    degreeInSignDms,
    dignityKey,
    nakshatraForLongitude,
    signName,
} from '../../lib/astro-display';
import { formatDms } from '../../lib/format';
import { useChartStyle } from '../../hooks/useChartStyle';
import { planetSign0, signIndex0, wholeSignHouse } from '../chart/geometry';

type PlanetRow = ChartPlanet & {
    sign: number;
    speed: number;
};

type Props = {
    ascendant: number;
    planets: PlanetRow[];
    meta: ChartMeta;
};

export function PlanetsPanel({ ascendant, planets, meta }: Props) {
    const [style, setStyle] = useChartStyle();
    const asc0 = signIndex0(ascendant);
    const { lang, t, num } = useI18n();

    const columns: DataColumn<PlanetRow>[] = [
        { key: 'name', header: t('planets.body'), render: (p) => planetName(p.name, lang) },
        { key: 'sign', header: t('planets.sign'), render: (p) => signName(p.sign, lang) },
        {
            key: 'lon',
            header: t('planets.longitude'),
            className: 'mono',
            render: (p) => formatDms(p.longitude),
        },
        {
            key: 'deg',
            header: t('planets.inSign'),
            className: 'mono',
            render: (p) => degreeInSignDms(p.degree ?? ((p.longitude % 30) + 30) % 30),
        },
        {
            key: 'nak',
            header: t('planets.nakshatra'),
            className: 'col-nak',
            render: (p) => {
                const n = nakshatraForLongitude(p.longitude, lang);
                return t('planets.nakPada', { name: n.name, pada: n.pada });
            },
        },
        {
            key: 'house',
            header: t('planets.house'),
            render: (p) => String(wholeSignHouse(planetSign0(p), asc0)),
        },
        {
            key: 'dig',
            header: t('planets.dignity'),
            render: (p) => {
                const key = dignityKey(p.name, p.sign);
                return key ? t(`dignity.${key}`) : '—';
            },
        },
        {
            key: 'spd',
            header: t('planets.motion'),
            className: 'mono',
            render: (p) =>
                p.speed < 0
                    ? t('chart.retrograde')
                    : t('planets.speed', { speed: num(p.speed, 4) }),
        },
    ];

    const chartPlanets: ChartPlanet[] = planets.map((p) => ({
        name: p.name,
        longitude: p.longitude,
        sign: p.sign,
        degree: p.degree,
        speed: p.speed,
    }));

    return (
        <div className="grid-2 grid-2--chart-table" data-testid="panel-chart">
            <div className="card chart-panel">
                <ChartToggle value={style} onChange={setStyle} className="chart-panel__toggle" />
                <ErrorBoundary title={t('chart.failed')}>
                    <ChartView
                        style={style}
                        ascendant={ascendant}
                        planets={chartPlanets}
                        meta={meta}
                        chartKey={`d1-${style}`}
                    />
                </ErrorBoundary>
            </div>
            <div className="card card--table-scroll">
                <h3>{t('planets.title')}</h3>
                <DataTable
                    columns={columns}
                    rows={planets}
                    rowKey={(p) => p.name}
                    testId="planets-table"
                />
            </div>
        </div>
    );
}
