import { formatDms } from '../../lib/format';
import { degreeInSignDms, signName } from '../../lib/astro-display';
import type { ChartMeta, ChartPlanet } from './types';
import {
    SOUTH_CENTER,
    SOUTH_FRAME_PATH,
    SOUTH_SIGN_CELLS,
    degreeInSign,
    isRetrograde,
    planetShortName,
    planetSign0,
    planetStackLayout,
    signIndex0,
    signLabel,
} from './geometry';

type Props = {
    ascendant: number;
    planets: ChartPlanet[];
    meta?: ChartMeta;
    chartKey?: string;
    compact?: boolean;
};

export function SouthIndianChart({ ascendant, planets, meta, chartKey, compact }: Props) {
    const ascSign0 = signIndex0(ascendant);
    const bySign = new Map<number, ChartPlanet[]>();
    for (const p of planets) {
        const s = planetSign0(p);
        const list = bySign.get(s) ?? [];
        list.push(p);
        bySign.set(s, list);
    }
    for (const list of bySign.values()) {
        list.sort((a, b) => a.name.localeCompare(b.name));
    }

    const cell = 21;
    const origin = 7;

    return (
        <div className={`chart-canvas${compact ? ' chart-canvas--compact' : ''}`}>
            <svg
                viewBox="0 0 100 100"
                role="img"
                aria-label="South Indian chart"
                className="chart-canvas__svg"
                key={chartKey}
            >
                <path className="chart-frame" d={SOUTH_FRAME_PATH} pathLength={1} />
                {meta && (
                    <foreignObject
                        x={SOUTH_CENTER.x}
                        y={SOUTH_CENTER.y}
                        width={SOUTH_CENTER.w}
                        height={SOUTH_CENTER.h}
                    >
                        <div className="chart-center-meta">
                            <div className="chart-center-meta__title">{meta.title}</div>
                            {meta.subtitle ? (
                                <div className="chart-center-meta__sub">{meta.subtitle}</div>
                            ) : null}
                            {meta.dateLabel ? (
                                <div className="chart-center-meta__sub">{meta.dateLabel}</div>
                            ) : null}
                            {meta.place ? (
                                <div className="chart-center-meta__sub">{meta.place}</div>
                            ) : null}
                        </div>
                    </foreignObject>
                )}
                {SOUTH_SIGN_CELLS.map(({ sign, row, col }) => {
                    const x = origin + col * cell;
                    const y = origin + row * cell;
                    const inSign = bySign.get(sign) ?? [];
                    const isLagna = sign === ascSign0;
                    const ys = planetStackLayout(inSign.length, y + 12, 5);
                    return (
                        <g key={sign}>
                            {isLagna && (
                                <line
                                    x1={x + 1}
                                    y1={y + cell - 2}
                                    x2={x + cell - 2}
                                    y2={y + 1}
                                    className="chart-lagna-diagonal"
                                />
                            )}
                            <text x={x + 2.5} y={y + 5.5} className="chart-sign-num">
                                {signLabel(sign)}
                            </text>
                            {inSign.map((p, idx) => (
                                <text
                                    key={p.name}
                                    x={x + 2.5}
                                    y={ys[idx] ?? y + 10}
                                    className="chart-planet"
                                >
                                    <title>
                                        {p.name} · {signName(sign + 1)} ·{' '}
                                        {degreeInSignDms(degreeInSign(p))} ({formatDms(p.longitude)}
                                        ){isRetrograde(p) ? ' · Retrograde' : ''}
                                    </title>
                                    {planetShortName(p.name)}
                                    {isRetrograde(p) ? ' R' : ''}
                                </text>
                            ))}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
