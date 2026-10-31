import { DateTime } from 'luxon';

import { generateCyclicDasha } from '../../src/dashas/cyclic.js';
import { CYCLIC_DASHA_SPECS } from '../../src/dashas/specs.js';

describe('Cyclic dasha systems', () => {
    test.each(Object.values(CYCLIC_DASHA_SPECS))('$id durations sum to cycle length', (spec) => {
        const sum = spec.order.reduce((acc, lord) => acc + spec.durationsYears[lord]!, 0);
        expect(sum).toBeCloseTo(spec.cycleYears, 6);
    });

    test('Ashtottari antardashas sum to maha length', () => {
        const birth = DateTime.fromISO('1990-05-15T10:00:00+05:30');
        const moon = 45.5;
        const periods = generateCyclicDasha('ashtottari', birth, moon, 2);
        const first = periods[0]!;
        const subSum = first.subPeriods!.reduce((a, s) => a + s.durationYears, 0);
        expect(subSum).toBeCloseTo(first.durationYears, 3);
    });
});
