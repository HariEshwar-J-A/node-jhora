import { useCallback, useState } from 'react';

export type ChartStyleId = 'north' | 'south' | 'east';

const STORAGE_KEY = 'njh-chart-style';

function read(): ChartStyleId {
    try {
        const v = localStorage.getItem(STORAGE_KEY);
        if (v === 'north' || v === 'south' || v === 'east') return v;
    } catch {
        /* ignore */
    }
    return 'north';
}

export function useChartStyle(): [ChartStyleId, (style: ChartStyleId) => void] {
    const [style, setStyleState] = useState<ChartStyleId>(read);
    const setStyle = useCallback((next: ChartStyleId) => {
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            /* ignore */
        }
        setStyleState(next);
    }, []);
    return [style, setStyle];
}
