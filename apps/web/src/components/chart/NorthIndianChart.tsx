import { formatDms } from '../../lib/format';
import { degreeInSignDms, signName } from '../../lib/astro-display';
import type { ChartMeta, ChartPlanet } from './types';
import {
    NORTH_FRAME_PATH,
    NORTH_HOUSE_ANCHORS,
    NORTH_VIEW_BOX,
    degreeInSign,
    isRetrograde,
    planetShortName,
    planetSign0,
    northHousePlanetLayout,
    signIndex0,
    signLabel,
    wholeSignHouse,
} from './geometry';

type Props = {
    ascendant: number;
    planets: ChartPlanet[];
    chartKey?: string;
    compact?: boolean;
};

function formatPlanetLine(p: ChartPlanet, compact: boolean): string {
    const d = Math.floor(degreeInSign(p));
    const retro = isRetrograde(p) ? ' R' : '';
    if (compact) {
        return `${planetShortName(p.name)}${d}${retro}`;
    }
    return `${planetShortName(p.name)} ${d}°${retro}`;
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
                <path className="chart-frame" d={NORTH_FRAME_PATH} pathLength={1} />
                {Array.from({ length: 12 }, (_, i) => {
                    const house = i + 1;
                    const sign0 = (ascSign0 + i) % 12;
                    const anchor = NORTH_HOUSE_ANCHORS[house]!;
                    const inHouse = byHouse.get(house) ?? [];
                    const slots = northHousePlanetLayout(inHouse.length, anchor, house);
                    return (
                        <g key={house} className="chart-house">
                            <text
                                x={anchor.x}
                                y={anchor.y - 4}
                                textAnchor="middle"
                                className="chart-sign-num"
                            >
                                {signLabel(sign0)}
                            </text>
                            {house === 1 && (
                                <text
                                    x={anchor.x}
                                    y={anchor.y - 8}
                                    textAnchor="middle"
                                    className="chart-lagna-tag"
                                >
                                    Asc
                                </text>
                            )}
                            {inHouse.map((p, idx) => {
                                const fs = slots[idx]?.fontSize ?? 4.25;
                                return (
                                    <text
                                        key={p.name}
                                        x={slots[idx]?.x ?? anchor.x}
                                        y={slots[idx]?.y ?? anchor.y + 6}
                                        textAnchor="middle"
                                        className="chart-planet"
                                        fontSize={fs}
                                    >
                                        <title>
                                            {p.name} · {signName(planetSign0(p) + 1)} ·{' '}
                                            {degreeInSignDms(degreeInSign(p))} (
                                            {formatDms(p.longitude)})
                                            {isRetrograde(p) ? ' · Retrograde' : ''}
                                        </title>
                                        {formatPlanetLine(p, fs < 3.2)}
                                    </text>
                                );
                            })}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
}
