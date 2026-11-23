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
    planetSign0,
    southCellRect,
    southCenterMetaLines,
    signIndex0,
    signLabel,
} from './geometry';
import {
    CHART_COMPACT_PLANET_FONT,
    CHART_SIGN_FONT_SIZE,
    CHART_SIGN_FONT_SIZE_COMPACT,
    formatPlanetLabel,
    layoutLabelsInRect,
    southLagnaTick,
    southPlanetTextRect,
    southSignPosition,
} from './chartLayout';

type Props = {
    ascendant: number;
    planets: ChartPlanet[];
    meta?: ChartMeta;
    chartKey?: string;
    compact?: boolean;
    planetFont?: number;
};

export function SouthIndianChart({
    ascendant,
    planets,
    meta,
    chartKey,
    compact,
    planetFont,
}: Props) {
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

    const signFont = compact ? CHART_SIGN_FONT_SIZE_COMPACT : CHART_SIGN_FONT_SIZE;

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
                    const signText = signLabel(sign);
                    const signPos = southSignPosition(rect, isLagna);
                    const textRect = southPlanetTextRect(rect);
                    const labelItems = inSign.map((p) => ({
                        id: p.name,
                        text: formatPlanetLabel(p.name, degreeInSign(p), isRetrograde(p), compact),
                    }));
                    const placed = layoutLabelsInRect(
                        textRect,
                        labelItems,
                        compact
                            ? { fontSize: CHART_COMPACT_PLANET_FONT }
                            : planetFont
                              ? { fontSize: planetFont }
                              : undefined,
                    );
                    const tick = isLagna ? southLagnaTick(rect) : null;
                    return (
                        <g key={sign} className="chart-house">
                            {tick && (
                                <line
                                    x1={tick.x1}
                                    y1={tick.y1}
                                    x2={tick.x2}
                                    y2={tick.y2}
                                    className="chart-lagna-diagonal"
                                />
                            )}
                            <text
                                x={signPos.x}
                                y={signPos.y}
                                textAnchor="start"
                                className="chart-sign-num chart-sign-num--south"
                                fontSize={signFont}
                            >
                                {signText}
                            </text>
                            {placed.map((slot) => {
                                const p = inSign.find((x) => x.name === slot.id)!;
                                return (
                                    <g key={slot.id}>
                                        <title>
                                            {p.name} · {signName(sign + 1)} ·{' '}
                                            {degreeInSignDms(degreeInSign(p))} (
                                            {formatDms(p.longitude)})
                                            {isRetrograde(p) ? ' · Retrograde' : ''}
                                        </title>
                                        <text
                                            x={slot.x}
                                            y={slot.y}
                                            textAnchor={slot.textAnchor}
                                            className="chart-planet"
                                            fontSize={slot.fontSize}
                                        >
                                            {slot.text}
                                        </text>
                                    </g>
                                );
                            })}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
