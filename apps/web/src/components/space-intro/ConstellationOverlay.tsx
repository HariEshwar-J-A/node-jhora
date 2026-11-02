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
            <defs>
                <radialGradient id="star-glow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                    <stop offset="35%" stopColor="#c8d8ff" stopOpacity="0.85" />
                    <stop offset="100%" stopColor="#6080c0" stopOpacity="0" />
                </radialGradient>
                <filter id="star-bloom" x="-80%" y="-80%" width="260%" height="260%">
                    <feGaussianBlur stdDeviation="0.004" result="b" />
                    <feMerge>
                        <feMergeNode in="b" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
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
                        <circle
                            key={i}
                            cx={cx}
                            cy={cy}
                            r={0.0028}
                            className="constellation-star"
                            fill="url(#star-glow)"
                            filter="url(#star-bloom)"
                            style={{ animationDelay: `${0.8 + i * 0.05}s` }}
                        />
                    ))}
                </g>
            ))}
        </svg>
    );
}
