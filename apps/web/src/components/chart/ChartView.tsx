import { EastIndianChart } from './EastIndianChart';
import { NorthIndianChart } from './NorthIndianChart';
import { SouthIndianChart } from './SouthIndianChart';
import type { ChartMeta, ChartPlanet } from './types';
import type { ChartStyleId } from '../../hooks/useChartStyle';

type Props = {
    style: ChartStyleId;
    ascendant: number;
    planets: ChartPlanet[];
    meta?: ChartMeta;
    chartKey?: string;
    compact?: boolean;
};

export function ChartView({ style, ascendant, planets, meta, chartKey, compact }: Props) {
    if (style === 'south') {
        return (
            <SouthIndianChart
                ascendant={ascendant}
                planets={planets}
                meta={meta}
                chartKey={chartKey}
                compact={compact}
            />
        );
    }
    if (style === 'east') {
        return (
            <EastIndianChart
                ascendant={ascendant}
                planets={planets}
                meta={meta}
                chartKey={chartKey}
                compact={compact}
            />
        );
    }
    return (
        <NorthIndianChart
            ascendant={ascendant}
            planets={planets}
            chartKey={chartKey}
            compact={compact}
        />
    );
}
