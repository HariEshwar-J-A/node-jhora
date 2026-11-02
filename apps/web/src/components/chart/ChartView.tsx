import { useEffect, useState } from 'react';
import { EastIndianChart } from './EastIndianChart';
import { NorthIndianChart } from './NorthIndianChart';
import { SouthIndianChart } from './SouthIndianChart';
import { CHART_NARROW_PLANET_FONT } from './chartLayout';
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

function useNarrowPlanetFont(): number | undefined {
    const [narrow, setNarrow] = useState(
        () => typeof window !== 'undefined' && window.matchMedia('(max-width: 520px)').matches,
    );
    useEffect(() => {
        const media = window.matchMedia('(max-width: 520px)');
        const apply = () => setNarrow(media.matches);
        apply();
        media.addEventListener('change', apply);
        return () => media.removeEventListener('change', apply);
    }, []);
    return narrow ? CHART_NARROW_PLANET_FONT : undefined;
}

export function ChartView({ style, ascendant, planets, meta, chartKey, compact }: Props) {
    const planetFont = useNarrowPlanetFont();
    const font = compact ? undefined : planetFont;
    if (style === 'south') {
        return (
            <SouthIndianChart
                ascendant={ascendant}
                planets={planets}
                meta={meta}
                chartKey={chartKey}
                compact={compact}
                planetFont={font}
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
                planetFont={font}
            />
        );
    }
    return (
        <NorthIndianChart
            ascendant={ascendant}
            planets={planets}
            meta={meta}
            chartKey={chartKey}
            compact={compact}
            planetFont={font}
        />
    );
}
