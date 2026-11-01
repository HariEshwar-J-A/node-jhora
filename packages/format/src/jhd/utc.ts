// Copyright (c) 2026 Harieshwar Jagan Abirami. All rights reserved. See LICENSE.

import type { JhdChart } from './types.js';

/** UTC instant of birth from local clock time and stored offset. */
export function jhdToUtcISO(chart: JhdChart): string {
    const ms =
        Date.UTC(chart.year, chart.month - 1, chart.day) +
        Math.round((chart.hour - chart.tzHours) * 3_600_000);
    return new Date(ms).toISOString();
}
