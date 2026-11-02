import { formatDms } from '../../lib/format';
import { degreeInSignDms, signName } from '../../lib/astro-display';
import type { ChartMeta, ChartPlanet } from './types';
import {
    SOUTH_CENTER,
    SOUTH_FRAME_PATH,
    SOUTH_SIGN_CELLS,
    SOUTH_VIEW_BOX,
    degreeInSign,
    isRetrograde,
    planetShortName,
    planetSign0,
    southCellPlanetLayout,
    southCellRect,
    southCenterMetaLines,
    southSignLabelAnchor,
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

function formatPlanetLine(p: ChartPlanet): string {
    const d = Math.floor(degreeInSign(p));
    const retro = isRetrograde(p) ? ' R' : '';
    return `${planetShortName(p.name)} ${d}°${retro}`;
}

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

    return (
        <div className={`chart-canvas${compact ? ' chart-canvas--compact' : ''}`}>
            <svg
                viewBox={SOUTH_VIEW_BOX}
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label="South Indian chart"
                className="chart-canvas__svg"
                key={chartKey}
            >
                <path className="chart-frame" d={SOUTH_FRAME_PATH} pathLength={1} />
                {meta &&
                    (() => {
                        const { lines, fontSize } = southCenterMetaLines(meta);
                        const cx = SOUTH_CENTER.x + SOUTH_CENTER.w / 2;
                        const cy = SOUTH_CENTER.y + SOUTH_CENTER.h / 2;
                        const lineGap = fontSize * 1.35;
                        const startY = cy - ((lines.length - 1) * lineGap) / 2;
                        return (
                            <text
                                x={cx}
                                y={startY}
                                textAnchor="middle"
                                className="chart-center-meta-svg"
                                fontSize={fontSize}
                            >
                                {lines.map((line, i) => (
                                    <tspan key={i} x={cx} dy={i === 0 ? 0 : lineGap}>
                                        {line}
                                    </tspan>
                                ))}
                            </text>
                        );
                    })()}
                {SOUTH_SIGN_CELLS.map(({ sign, row, col }) => {
                    const rect = southCellRect(row, col);
                    const inSign = bySign.get(sign) ?? [];
                    const isLagna = sign === ascSign0;
                    const signPos = southSignLabelAnchor(row, col);
                    const slots = southCellPlanetLayout(inSign.length, rect);
                    return (
                        <g key={sign}>
                            {isLagna && (
                                <line
                                    x1={rect.x + 1}
                                    y1={rect.y + rect.size - 1.5}
                                    x2={rect.x + rect.size - 1.5}
                                    y2={rect.y + 1}
                                    className="chart-lagna-diagonal"
                                />
                            )}
                            <text x={signPos.x} y={signPos.y} className="chart-sign-num">
                                {signLabel(sign)}
                            </text>
                            {inSign.map((p, idx) => (
                                <text
                                    key={p.name}
                                    x={slots[idx]?.x ?? rect.x + 3}
                                    y={slots[idx]?.y ?? rect.y + 11}
                                    textAnchor="middle"
                                    className="chart-planet"
                                    fontSize={slots[idx]?.fontSize ?? 3.1}
                                >
                                    <title>
                                        {p.name} · {signName(sign + 1)} ·{' '}
                                        {degreeInSignDms(degreeInSign(p))} ({formatDms(p.longitude)}
                                        ){isRetrograde(p) ? ' · Retrograde' : ''}
                                    </title>
                                    {formatPlanetLine(p)}
                                </text>
                            ))}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
