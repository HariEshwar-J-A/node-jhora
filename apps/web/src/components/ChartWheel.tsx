import { formatDms, SIGN_NAMES } from '../lib/format';

interface Planet {
    name: string;
    longitude: number;
}

interface Props {
    style: 'north' | 'south';
    ascendant: number;
    planets: Planet[];
}

function signIndex(lon: number): number {
    return Math.floor((((lon % 360) + 360) % 360) / 30);
}

export function ChartWheel({ style, ascendant, planets }: Props) {
    const ascSign = signIndex(ascendant);
    if (style === 'north') {
        return (
            <div className="chart-wheel">
                <svg viewBox="0 0 200 200" role="img" aria-label="North Indian chart">
                    <polygon
                        points="100,10 190,100 100,190 10,100"
                        fill="none"
                        stroke="currentColor"
                    />
                    {[0, 1, 2, 3].map((q) => {
                        const houses = [
                            (ascSign + q * 3) % 12,
                            (ascSign + q * 3 + 1) % 12,
                            (ascSign + q * 3 + 2) % 12,
                        ];
                        const cx = q === 0 || q === 2 ? 100 : q === 1 ? 145 : 55;
                        const cy = q === 1 || q === 3 ? 100 : q === 0 ? 55 : 145;
                        return (
                            <g key={q} opacity={0.85}>
                                {houses.map((h, i) => (
                                    <text
                                        key={h}
                                        x={cx + (i - 1) * 18}
                                        y={cy + (i - 1) * 6}
                                        fontSize="6"
                                        fill="currentColor"
                                        opacity={0.55}
                                    >
                                        {SIGN_NAMES[h].slice(0, 3)}
                                    </text>
                                ))}
                            </g>
                        );
                    })}
                    {planets.map((p, idx) => (
                        <text
                            key={p.name}
                            x={20 + (idx % 4) * 42}
                            y={175 + Math.floor(idx / 4) * 8}
                            fontSize="5.5"
                            fill="currentColor"
                            fontWeight={idx === 0 ? 600 : 400}
                        >
                            {p.name.slice(0, 2)} {formatDms(p.longitude)}
                        </text>
                    ))}
                </svg>
            </div>
        );
    }

    return (
        <div className="chart-wheel">
            <svg viewBox="0 0 220 220" role="img" aria-label="South Indian chart">
                {[0, 1, 2, 3].map((row) =>
                    [0, 1, 2, 3].map((col) => {
                        const idx = row * 4 + col;
                        const sign = idx;
                        const x = 10 + col * 52;
                        const y = 10 + row * 52;
                        const inSign = planets.filter((p) => signIndex(p.longitude) === sign);
                        return (
                            <g key={idx}>
                                <rect
                                    x={x}
                                    y={y}
                                    width={50}
                                    height={50}
                                    fill="none"
                                    stroke="currentColor"
                                />
                                <text
                                    x={x + 4}
                                    y={y + 10}
                                    fontSize="6"
                                    fill="currentColor"
                                    opacity={0.55}
                                >
                                    {SIGN_NAMES[sign].slice(0, 3)}
                                </text>
                                {inSign.slice(0, 3).map((p, i) => (
                                    <text
                                        key={p.name}
                                        x={x + 4}
                                        y={y + 18 + i * 8}
                                        fontSize="5.5"
                                        fill="currentColor"
                                        fontWeight={i === 0 ? 600 : 400}
                                    >
                                        {p.name.slice(0, 2)}
                                    </text>
                                ))}
                            </g>
                        );
                    }),
                )}
            </svg>
        </div>
    );
}
