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
    southCellRect,
    southCenterMetaLines,
    signIndex0,
    signLabel,
} from './geometry';
import {
    estimateTextHeight,
    estimateTextWidth,
    fitLabels,
    fitCornerLabel,
    rectCellPolygon,
    type ReservedBox,
} from './layoutFit';

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

function compactPlanetLine(p: ChartPlanet): string {
    const d = Math.floor(degreeInSign(p));
    const retro = isRetrograde(p) ? 'R' : '';
    return `${planetShortName(p.name)}${d}°${retro}`;
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
                    const poly = rectCellPolygon(rect.x, rect.y, rect.size);
                    const inSign = bySign.get(sign) ?? [];
                    const isLagna = sign === ascSign0;
                    const signText = signLabel(sign);
                    const signPreferred = { x: rect.x + 3.5, y: rect.y + 5.5 };
                    const signPlaced = fitCornerLabel(
                        poly,
                        signPreferred.x,
                        signPreferred.y,
                        signText,
                        compact ? 3.6 : 4.2,
                    );
                    const reserved: ReservedBox[] = [
                        {
                            x: signPlaced.x,
                            y: signPlaced.y,
                            w: estimateTextWidth(signText, signPlaced.fontSize),
                            h: estimateTextHeight(signPlaced.fontSize),
                            anchor: 'start',
                        },
                    ];
                    if (isLagna) {
                        reserved.push({
                            x: rect.x + rect.size * 0.12,
                            y: rect.y + rect.size * 0.88,
                            w: rect.size * 0.75,
                            h: 2,
                            anchor: 'start',
                        });
                    }
                    const planetAnchor = {
                        x: rect.x + rect.size / 2,
                        y: rect.y + rect.size * 0.58,
                    };
                    const placed = fitLabels(
                        poly,
                        planetAnchor,
                        inSign.map((p) => ({
                            id: p.name,
                            text: formatPlanetLine(p),
                            compactText: compactPlanetLine(p),
                        })),
                        {
                            reserved,
                            maxFontSize: compact ? 2.65 : 3.15,
                            minFontSize: compact ? 1.7 : 1.85,
                        },
                    );
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
                            <text
                                x={signPlaced.x}
                                y={signPlaced.y}
                                textAnchor="start"
                                className="chart-sign-num chart-sign-num--south"
                                fontSize={signPlaced.fontSize}
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
                                            textAnchor="middle"
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
