import type { ChartStyleId } from '../../hooks/useChartStyle';

type Props = {
    value: ChartStyleId;
    onChange: (style: ChartStyleId) => void;
    showEast?: boolean;
    className?: string;
};

const OPTIONS: { id: ChartStyleId; label: string }[] = [
    { id: 'north', label: 'North' },
    { id: 'south', label: 'South' },
    { id: 'east', label: 'East' },
];

export function ChartToggle({ value, onChange, showEast = true, className }: Props) {
    const opts = showEast ? OPTIONS : OPTIONS.filter((o) => o.id !== 'east');
    return (
        <div
            className={`chart-toggle${className ? ` ${className}` : ''}`}
            role="tablist"
            aria-label="Chart style"
        >
            {opts.map((o) => (
                <button
                    key={o.id}
                    type="button"
                    role="tab"
                    aria-selected={value === o.id}
                    className={`tab ${value === o.id ? 'active' : ''}`}
                    data-testid={`chart-style-${o.id}`}
                    onClick={() => onChange(o.id)}
                >
                    {o.label}
                </button>
            ))}
        </div>
    );
}
