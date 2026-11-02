import { formatDms } from '../../lib/format';
import { degreeInSignDms, signName } from '../../lib/astro-display';
import type { ChartMeta, ChartPlanet } from './types';
import {
    EAST_CENTER,
    EAST_FRAME_PATH,
    EAST_SIGNS,
    EAST_VIEW_BOX,
    degreeInSign,
    isRetrograde,
    planetSign0,
    signIndex0,
    signLabel,
    southCenterMetaLines,
} from './geometry';
import {
    CHART_COMPACT_PLANET_FONT,
    CHART_SIGN_FONT_SIZE,
    CHART_SIGN_FONT_SIZE_COMPACT,
    formatPlanetLabel,
    layoutLabelsInRect,
} from './chartLayout';

type Props = {
    ascendant: number;
    planets: ChartPlanet[];
    meta?: ChartMeta;
    chartKey?: string;
    compact?: boolean;
    planetFont?: number;
};

export function EastIndianChart({
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
                viewBox={EAST_VIEW_BOX}
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label="East Indian chart"
                className="chart-canvas__svg"
                key={chartKey}
            >
                <path className="chart-frame" d={EAST_FRAME_PATH} />
                {meta &&
                    (() => {
                        const { lines, fontSize } = southCenterMetaLines(meta);
                        const cx = EAST_CENTER.x + EAST_CENTER.w / 2;
                        const cy = EAST_CENTER.y + EAST_CENTER.h / 2;
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
                                    <tspan key={line} x={cx} dy={i === 0 ? 0 : lineGap}>
                                        {line}
                                    </tspan>
                                ))}
                            </text>
                        );
                    })()}
                {EAST_SIGNS.map((cell) => {
                    const inSign = bySign.get(cell.sign) ?? [];
                    const isLagna = cell.sign === ascSign0;
                    const labelItems = inSign.map((p) => ({
                        id: p.name,
                        text: formatPlanetLabel(p.name, degreeInSign(p), isRetrograde(p), compact),
                    }));
                    const placed = layoutLabelsInRect(
                        cell.text,
                        labelItems,
                        compact
                            ? { fontSize: CHART_COMPACT_PLANET_FONT }
                            : planetFont
                              ? { fontSize: planetFont }
                              : undefined,
                    );
                    return (
                        <g key={cell.sign} className="chart-house">
                            {isLagna && (
                                <line
                                    x1={cell.lagnaTick.x1}
                                    y1={cell.lagnaTick.y1}
                                    x2={cell.lagnaTick.x2}
                                    y2={cell.lagnaTick.y2}
                                    className="chart-lagna-diagonal chart-lagna-diagonal--east"
                                />
                            )}
                            <text
                                x={cell.signLabel.x}
                                y={cell.signLabel.y}
                                textAnchor="middle"
                                className="chart-sign-num"
                                fontSize={signFont}
                            >
                                {signLabel(cell.sign)}
                            </text>
                            {placed.map((slot) => {
                                const p = inSign.find((x) => x.name === slot.id)!;
                                return (
                                    <g key={slot.id}>
                                        <title>
                                            {p.name} · {signName(cell.sign + 1)} ·{' '}
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
