import type { ChartStyleId } from '../../hooks/useChartStyle';
import { useI18n } from '../../i18n';

type Props = {
    value: ChartStyleId;
    onChange: (style: ChartStyleId) => void;
    showEast?: boolean;
    className?: string;
};

const OPTIONS = [
    { id: 'north', label: 'chart.north' },
    { id: 'south', label: 'chart.south' },
    { id: 'east', label: 'chart.east' },
] as const;

export function ChartToggle({ value, onChange, showEast = true, className }: Props) {
    const { t } = useI18n();
    const opts = showEast ? OPTIONS : OPTIONS.filter((o) => o.id !== 'east');
    return (
        <div
            className={`chart-toggle${className ? ` ${className}` : ''}`}
            role="tablist"
            aria-label={t('chart.style')}
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
                    {t(o.label)}
                </button>
            ))}
        </div>
    );
}
