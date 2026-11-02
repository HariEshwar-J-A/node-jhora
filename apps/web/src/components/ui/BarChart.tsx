type Bar = {
    label: string;
    value: number;
    max?: number;
};

type Props = {
    bars: Bar[];
    unit?: string;
};

export function BarChart({ bars, unit }: Props) {
    const max = Math.max(...bars.map((b) => b.max ?? b.value), 1);
    return (
        <div className="bar-chart" role="img" aria-label="Bar chart">
            {bars.map((b) => {
                const pct = Math.min(100, (100 * b.value) / max);
                return (
                    <div key={b.label} className="bar-chart__row">
                        <span className="bar-chart__label">{b.label}</span>
                        <div className="bar-chart__track">
                            <span className="bar-chart__fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="bar-chart__value mono">
                            {b.value.toFixed(1)}
                            {unit ? ` ${unit}` : ''}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
