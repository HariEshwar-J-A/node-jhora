import { formatDms } from '../../lib/format';
import { degreeInSignDms, signName } from '../../lib/astro-display';
import type { ChartMeta, ChartPlanet } from './types';
import {
    NORTH_DIAGONAL_DIAMOND_PATH,
    NORTH_OUTER_SQUARE_PATH,
    NORTH_PLANET_RECTS,
    NORTH_SIGN_POSITIONS,
    NORTH_VIEW_BOX,
    degreeInSign,
    isRetrograde,
    planetSign0,
    northHouseSignNumber,
    signIndex0,
    signLabel,
    wholeSignHouse,
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

export function NorthIndianChart({
    ascendant,
    planets,
    meta,
    chartKey,
    compact,
    planetFont,
}: Props) {
    const ascSign0 = signIndex0(ascendant);
    const byHouse = new Map<number, ChartPlanet[]>();
    for (const p of planets) {
        const h = wholeSignHouse(planetSign0(p), ascSign0);
        const list = byHouse.get(h) ?? [];
        list.push(p);
        byHouse.set(h, list);
    }
    for (const list of byHouse.values()) {
        list.sort((a, b) => a.name.localeCompare(b.name));
    }

    const signFont = compact ? CHART_SIGN_FONT_SIZE_COMPACT : CHART_SIGN_FONT_SIZE;

    return (
        <div className={`chart-canvas${compact ? ' chart-canvas--compact' : ''}`}>
            {meta?.title && <p className="chart-canvas__caption">{meta.title}</p>}
            <svg
                viewBox={NORTH_VIEW_BOX}
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label="North Indian chart"
                className="chart-canvas__svg"
                key={chartKey}
            >
                <path className="chart-frame chart-frame--border" d={NORTH_OUTER_SQUARE_PATH} />
                <path
                    className="chart-frame chart-frame--inner"
                    d={NORTH_DIAGONAL_DIAMOND_PATH}
                    pathLength={1}
                />
                {Array.from({ length: 12 }, (_, i) => {
                    const house = i + 1;
                    const signText = signLabel(
                        (northHouseSignNumber(ascSign0, house) - 1 + 12) % 12,
                    );
                    const signPos = NORTH_SIGN_POSITIONS[house]!;
                    const inHouse = byHouse.get(house) ?? [];
                    const labelItems = inHouse.map((p) => ({
                        id: p.name,
                        text: formatPlanetLabel(p.name, degreeInSign(p), isRetrograde(p), compact),
                    }));
                    if (house === 1) {
                        labelItems.unshift({ id: '__asc__', text: 'Asc' });
                    }
                    const placed = layoutLabelsInRect(
                        NORTH_PLANET_RECTS[house]!,
                        labelItems,
                        compact
                            ? { fontSize: CHART_COMPACT_PLANET_FONT }
                            : planetFont
                              ? { fontSize: planetFont }
                              : undefined,
                    );
                    return (
                        <g key={house} className="chart-house">
                            <text
                                x={signPos.x}
                                y={signPos.y}
                                textAnchor="middle"
                                className="chart-sign-num"
                                fontSize={signFont}
                            >
                                {signText}
                            </text>
                            {placed.map((slot) => {
                                if (slot.id === '__asc__') {
                                    return (
                                        <text
                                            key="asc"
                                            x={slot.x}
                                            y={slot.y}
                                            textAnchor="middle"
                                            className="chart-lagna-tag"
                                            fontSize={slot.fontSize}
                                        >
                                            Asc
                                        </text>
                                    );
                                }
                                const p = inHouse.find((x) => x.name === slot.id)!;
                                return (
                                    <g key={slot.id}>
                                        <title>
                                            {p.name} · {signName(planetSign0(p) + 1)} ·{' '}
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
