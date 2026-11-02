import { DataTable, type DataColumn } from '../ui/DataTable';
import { ErrorBoundary } from '../ErrorBoundary';
import { ChartToggle } from '../chart/ChartToggle';
import { ChartView } from '../chart/ChartView';
import type { ChartMeta, ChartPlanet } from '../chart/types';
import {
    degreeInSignDms,
    dignityLabel,
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

    const columns: DataColumn<PlanetRow>[] = [
        { key: 'name', header: 'Body', render: (p) => p.name },
        { key: 'sign', header: 'Sign', render: (p) => signName(p.sign) },
        {
            key: 'lon',
            header: 'Longitude',
            className: 'mono',
            render: (p) => formatDms(p.longitude),
        },
        {
            key: 'deg',
            header: 'In sign',
            className: 'mono',
            render: (p) => degreeInSignDms(p.degree ?? ((p.longitude % 30) + 30) % 30),
        },
        {
            key: 'nak',
            header: 'Nakshatra',
            render: (p) => {
                const n = nakshatraForLongitude(p.longitude);
                return `${n.name} P${n.pada}`;
            },
        },
        {
            key: 'house',
            header: 'House',
            render: (p) => String(wholeSignHouse(planetSign0(p), asc0)),
        },
        {
            key: 'dig',
            header: 'Dignity',
            render: (p) => dignityLabel(p.name, p.sign),
        },
        {
            key: 'spd',
            header: 'Motion',
            className: 'mono',
            render: (p) => (p.speed < 0 ? 'Retrograde' : `${p.speed.toFixed(4)}°/d`),
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
        <div className="grid-2" data-testid="panel-chart">
            <div className="card chart-panel">
                <ChartToggle value={style} onChange={setStyle} className="chart-panel__toggle" />
                <ErrorBoundary title="Chart could not be rendered">
                    <ChartView
                        style={style}
                        ascendant={ascendant}
                        planets={chartPlanets}
                        meta={meta}
                        chartKey={`d1-${style}`}
                    />
                </ErrorBoundary>
            </div>
            <div className="card">
                <h3>Planets (sidereal)</h3>
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
