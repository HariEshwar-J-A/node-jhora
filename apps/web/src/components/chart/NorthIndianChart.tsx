import { formatDms } from '../../lib/format';
import { degreeInSignDms, signName } from '../../lib/astro-display';
import type { ChartPlanet } from './types';
import {
    NORTH_DIAGONAL_DIAMOND_PATH,
    NORTH_HOUSE_ANCHORS,
    NORTH_HOUSE_POLYGONS,
    NORTH_OUTER_SQUARE_PATH,
    NORTH_SIGN_LABEL_ANCHORS,
    NORTH_VIEW_BOX,
    degreeInSign,
    isRetrograde,
    planetShortName,
    planetSign0,
    signIndex0,
    signLabel,
    wholeSignHouse,
} from './geometry';
import {
    estimateTextHeight,
    estimateTextWidth,
    fitLabels,
    fitSignLabel,
    type ReservedBox,
} from './layoutFit';

type Props = {
    ascendant: number;
    planets: ChartPlanet[];
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

export function NorthIndianChart({ ascendant, planets, chartKey, compact }: Props) {
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

    return (
        <div className={`chart-canvas${compact ? ' chart-canvas--compact' : ''}`}>
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
                    const sign0 = (ascSign0 + i) % 12;
                    const anchor = NORTH_HOUSE_ANCHORS[house]!;
                    const poly = NORTH_HOUSE_POLYGONS[house]!;
                    const signText = signLabel(sign0);
                    const signPlaced = fitSignLabel(
                        poly,
                        NORTH_SIGN_LABEL_ANCHORS[house]!,
                        signText,
                        compact ? 3.8 : 4.5,
                    );
                    const reserved: ReservedBox[] = [
                        {
                            x: signPlaced.x,
                            y: signPlaced.y,
                            w: estimateTextWidth(signText, signPlaced.fontSize),
                            h: estimateTextHeight(signPlaced.fontSize),
                            anchor: 'middle',
                        },
                    ];
                    if (house === 1) {
                        reserved.push({
                            x: 50,
                            y: 20,
                            w: estimateTextWidth('Asc', 3),
                            h: estimateTextHeight(3),
                            anchor: 'middle',
                        });
                    }
                    const inHouse = byHouse.get(house) ?? [];
                    const placed = fitLabels(
                        poly,
                        anchor,
                        inHouse.map((p) => ({
                            id: p.name,
                            text: formatPlanetLine(p),
                            compactText: compactPlanetLine(p),
                        })),
                        {
                            reserved,
                            maxFontSize: compact ? 2.8 : 3.55,
                            minFontSize: compact ? 1.75 : 1.9,
                        },
                    );
                    return (
                        <g key={house} className="chart-house">
                            <text
                                x={signPlaced.x}
                                y={signPlaced.y}
                                textAnchor="middle"
                                className="chart-sign-num"
                                fontSize={signPlaced.fontSize}
                            >
                                {signText}
                            </text>
                            {house === 1 && (
                                <text x={50} y={20} textAnchor="middle" className="chart-lagna-tag">
                                    Asc
                                </text>
                            )}
                            {placed.map((slot) => {
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
