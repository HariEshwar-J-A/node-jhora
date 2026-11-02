import {
    degreeInSign,
    isRetrograde,
    planetShortName,
    planetSign0,
    signIndex0,
    signLabel,
    wholeSignHouse,
} from './geometry';
import { formatDms } from '../../lib/format';
import type { ChartMeta, ChartPlanet } from './types';

/** East Indian (Bengali/Odia-style) — rectangular 3×4 house grid, Lagna in house 1. */
type Props = {
    ascendant: number;
    planets: ChartPlanet[];
    meta?: ChartMeta;
    chartKey?: string;
    compact?: boolean;
};

const EAST_LAYOUT: { house: number; x: number; y: number; w: number; h: number }[] = [
    { house: 1, x: 34, y: 4, w: 32, h: 22 },
    { house: 2, x: 68, y: 4, w: 28, h: 22 },
    { house: 3, x: 68, y: 28, w: 28, h: 22 },
    { house: 4, x: 68, y: 52, w: 28, h: 22 },
    { house: 5, x: 68, y: 76, w: 28, h: 20 },
    { house: 6, x: 34, y: 76, w: 32, h: 20 },
    { house: 7, x: 4, y: 76, w: 28, h: 20 },
    { house: 8, x: 4, y: 52, w: 28, h: 22 },
    { house: 9, x: 4, y: 28, w: 28, h: 22 },
    { house: 10, x: 4, y: 4, w: 28, h: 22 },
    { house: 11, x: 34, y: 28, w: 32, h: 22 },
    { house: 12, x: 34, y: 52, w: 32, h: 22 },
];

export function EastIndianChart({ ascendant, planets, meta, chartKey, compact }: Props) {
    const ascSign0 = signIndex0(ascendant);
    const byHouse = new Map<number, ChartPlanet[]>();
    for (const p of planets) {
        const h = wholeSignHouse(planetSign0(p), ascSign0);
        const list = byHouse.get(h) ?? [];
        list.push(p);
        byHouse.set(h, list);
    }

    const frame =
        'M 4 4 H 96 V 96 H 4 Z ' +
        EAST_LAYOUT.map(({ x, y, w, h }) => `M ${x} ${y} H ${x + w} V ${y + h} H ${x} Z`).join(' ');

    return (
        <div className={`chart-canvas${compact ? ' chart-canvas--compact' : ''}`}>
            <svg
                viewBox="0 0 100 100"
                role="img"
                aria-label="East Indian chart"
                className="chart-canvas__svg"
                key={chartKey}
            >
                <path className="chart-frame" d={frame} pathLength={1} />
                {meta && (
                    <text x={50} y={42} textAnchor="middle" className="chart-center-meta-svg">
                        {meta.title}
                    </text>
                )}
                {EAST_LAYOUT.map(({ house, x, y }) => {
                    const sign0 = (ascSign0 + house - 1) % 12;
                    const inHouse = byHouse.get(house) ?? [];
                    return (
                        <g key={house}>
                            <text x={x + 3} y={y + 6} className="chart-sign-num">
                                {signLabel(sign0)}
                                {house === 1 ? ' Asc' : ''}
                            </text>
                            {inHouse.slice(0, 4).map((p, i) => (
                                <text
                                    key={p.name}
                                    x={x + 3}
                                    y={y + 11 + i * 4.5}
                                    className="chart-planet"
                                >
                                    <title>
                                        {p.name} · {formatDms(p.longitude)}
                                    </title>
                                    {planetShortName(p.name)}
                                    {isRetrograde(p) ? ' R' : ''} {Math.floor(degreeInSign(p))}°
                                </text>
                            ))}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
