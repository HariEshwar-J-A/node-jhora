import { SKY_CONSTELLATIONS } from './constellations';

type Props = {
    visible: boolean;
    sparse?: boolean;
    className?: string;
};

function StarGlyph({ x, y, mag, index }: { x: number; y: number; mag: number; index: number }) {
    const core = 0.00105 + mag * 0.00085;
    const glow = core * (1.7 + mag * 0.6);
    const spike = core * (6.2 + mag * 2.4);
    return (
        <g
            className="constellation-star"
            transform={`translate(${x} ${y})`}
            style={{ animationDelay: `${(index % 8) * 0.41}s` }}
        >
            <circle r={glow} className="constellation-star__glow" />
            {mag >= 0.72 && (
                <g className="constellation-star__spikes" strokeWidth={0.00042}>
                    <line x1={-spike} y1={0} x2={spike} y2={0} />
                    <line x1={0} y1={-spike} x2={0} y2={spike} />
                </g>
            )}
            <circle r={core} className="constellation-star__core" />
        </g>
    );
}

/** Real stars: white core, soft additive glow, spikes on the brightest. Lines stay unfilled. */
export function ConstellationOverlay({ visible, sparse, className }: Props) {
    let starIndex = 0;
    return (
        <svg
            className={`constellation-overlay${sparse ? ' constellation-overlay--sparse' : ''}${className ? ` ${className}` : ''}${visible ? ' constellation-overlay--visible' : ''}`}
            viewBox="0 0 1 1"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
        >
            {SKY_CONSTELLATIONS.map((c) => (
                <g key={c.name} className="constellation-group">
                    {c.segments.map(([x1, y1, x2, y2], i) => (
                        <line
                            key={i}
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            className="constellation-line"
                            pathLength={1}
                            style={{ animationDelay: `${i * 0.12}s` }}
                        />
                    ))}
                    {c.stars.map(([cx, cy, mag]) => {
                        const index = starIndex;
                        starIndex += 1;
                        return <StarGlyph key={index} x={cx} y={cy} mag={mag} index={index} />;
                    })}
                </g>
            ))}
        </svg>
    );
}
