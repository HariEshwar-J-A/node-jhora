import { calculateVarga } from '@node-jhora/core';
import { useMemo, useState } from 'react';
import { VARGA_PICKER_DIVISIONS } from '../../lib/astro-display';
import { ChartToggle } from './ChartToggle';
import { ChartView } from './ChartView';
import type { ChartMeta, ChartPlanet } from './types';
import { useChartStyle } from '../../hooks/useChartStyle';

interface VargaPoint {
    planetName: string;
    sign: number;
    longitude: number;
    degree?: number;
}

type Props = {
    ascendant: number;
    d1Planets: ChartPlanet[];
    vargas: Record<string, VargaPoint[]>;
    meta: ChartMeta;
};

function toPlanets(points: VargaPoint[]): ChartPlanet[] {
    return points.map((p) => ({
        name: p.planetName,
        longitude: p.longitude,
        sign: p.sign,
        degree: p.degree,
    }));
}

function pointsForDivision(
    division: number,
    d1: ChartPlanet[],
    vargas: Record<string, VargaPoint[]>,
): ChartPlanet[] {
    const key = `D${division}`;
    if (vargas[key]?.length) return toPlanets(vargas[key]);
    return d1.map((p) => {
        const v = calculateVarga(p.longitude, division);
        return {
            name: p.name,
            longitude: v.longitude,
            sign: v.sign,
            degree: v.degree,
        };
    });
}

export function VargaBoard({ ascendant, d1Planets, vargas, meta }: Props) {
    const [style, setStyle] = useChartStyle();
    const [selected, setSelected] = useState<number[]>([1, 9, 10, 12]);
    const [pickerDiv, setPickerDiv] = useState(9);

    const gridDivisions = useMemo(() => {
        const base = [...selected];
        if (!base.includes(pickerDiv)) base.unshift(pickerDiv);
        return [...new Set(base)].slice(0, 8);
    }, [selected, pickerDiv]);

    const toggleGridDiv = (d: number) => {
        setSelected((prev) =>
            prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].slice(-6),
        );
    };

    return (
        <div className="varga-board" data-testid="panel-vargas">
            <div className="varga-board__toolbar">
                <ChartToggle value={style} onChange={setStyle} />
                <label className="varga-board__picker">
                    <span>Varga</span>
                    <select
                        value={pickerDiv}
                        onChange={(e) => setPickerDiv(Number(e.target.value))}
                    >
                        {VARGA_PICKER_DIVISIONS.map((d) => (
                            <option key={d} value={d}>
                                D{d}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <div className="varga-board__hero">
                <ChartView
                    style={style}
                    ascendant={calculateVarga(ascendant, pickerDiv).longitude}
                    planets={pointsForDivision(pickerDiv, d1Planets, vargas)}
                    meta={{ ...meta, title: meta.title, subtitle: `D${pickerDiv}` }}
                    chartKey={`D${pickerDiv}-${style}`}
                />
            </div>
            <p className="varga-board__hint">
                Tap divisions to add or remove from the grid (up to six).
            </p>
            <div className="varga-board__chips">
                {VARGA_PICKER_DIVISIONS.map((d) => (
                    <button
                        key={d}
                        type="button"
                        className={`tab ${selected.includes(d) ? 'active' : ''}`}
                        onClick={() => toggleGridDiv(d)}
                    >
                        D{d}
                    </button>
                ))}
            </div>
            <div className="varga-board__grid">
                {gridDivisions.map((d) => (
                    <figure key={d} className="varga-thumb">
                        <figcaption>D{d}</figcaption>
                        <ChartView
                            style={style}
                            ascendant={calculateVarga(ascendant, d).longitude}
                            planets={pointsForDivision(d, d1Planets, vargas)}
                            meta={{ ...meta, title: `D${d}`, subtitle: meta.subtitle }}
                            compact
                            chartKey={`grid-D${d}-${style}`}
                        />
                    </figure>
                ))}
            </div>
        </div>
    );
}
