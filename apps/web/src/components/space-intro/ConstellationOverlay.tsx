import { SKY_CONSTELLATIONS } from './constellations';

type Props = {
    visible: boolean;
    className?: string;
};

export function ConstellationOverlay({ visible, className }: Props) {
    return (
        <svg
            className={`constellation-overlay${className ? ` ${className}` : ''}${visible ? ' constellation-overlay--visible' : ''}`}
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
                            style={{ animationDelay: `${i * 0.15}s` }}
                        />
                    ))}
                    {c.stars.map(([cx, cy], i) => (
                        <circle key={i} cx={cx} cy={cy} r={0.004} className="constellation-star" />
                    ))}
                </g>
            ))}
        </svg>
    );
}
