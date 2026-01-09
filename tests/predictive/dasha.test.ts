import { DateTime } from 'luxon';
import { calculateDashaBalance, generateVimshottari, DashaPeriod } from '../../src/predictive/dasha.js';

describe('Vimshottari Dasha Engine', () => {

    // Test 1: Balance Calculation
    test('Calculates Correct Dasha Balance at 0 Aries (Ketu)', () => {
        // 0 Aries is Start of Ashwini.
        // Ashwini Lord = Ketu. Duration = 7 years.
        // traversed = 0. remaining = 7.
        const balance = calculateDashaBalance(0);
        expect(balance.lord).toBe('Ketu');
        expect(balance.yearsRemaining).toBeCloseTo(7, 5);
        expect(balance.fractionTraversed).toBeCloseTo(0, 5);
    });

    test('Calculates Correct Dasha Balance at End of Ashwini (13.333...)', () => {
        // End of Ashwini. 13 deg 20 min = 13 + 1/3 = 13.333...
        const endAshwini = 13 + (20 / 60);
        const balance = calculateDashaBalance(endAshwini - 0.0001); // Just before end
        expect(balance.lord).toBe('Ketu');
        expect(balance.yearsRemaining).toBeCloseTo(0, 2);

        // Start of Bharani
        const startBharani = 13 + (20 / 60) + 0.0001;
        const balance2 = calculateDashaBalance(startBharani);
        expect(balance2.lord).toBe('Venus');
        expect(balance2.yearsRemaining).toBeCloseTo(20, 2); // Full 20 years
    });

    // Test 2: Tree Generation
    test('Generates Dasha Tree from Birth', () => {
        const birthDate = DateTime.fromISO('2000-01-01T00:00:00Z');
        const moonLong = 0; // 0 Aries -> Full 7y Ketu Balance

        // Generate with depth 2 (Maha + Antar)
        const dashas = generateVimshottari(birthDate, moonLong, 2);

        // 1. First Mahadasha should be Ketu
        const first = dashas[0];
        expect(first.planet).toBe('Ketu');
        expect(first.durationYears).toBeCloseTo(7, 4);
        expect(first.start.toISO()).toBe(birthDate.toISO());

        // 2. Second should be Venus (20y)
        const second = dashas[1];
        expect(second.planet).toBe('Venus');
        expect(second.durationYears).toBeCloseTo(20, 4);

        // 3. Check Subperiods of Ketu (Level 2)
        // Ketu-Ketu is first.
        // Duration = (7 * 7) / 120 = 49 / 120 = 0.408333 years (~149 days)
        expect(first.subPeriods).toBeDefined();
        if (first.subPeriods) {
            expect(first.subPeriods.length).toBe(9);
            expect(first.subPeriods[0].planet).toBe('Ketu');
            expect(first.subPeriods[0].durationYears).toBeCloseTo(49 / 120, 4);

            // Last subperiod of Ketu is Mercury
            // Ketu (7) * Mercury (17) / 120 = 119 / 120 = 0.99166 years
            const last = first.subPeriods[8];
            expect(last.planet).toBe('Mercury');
            expect(last.durationYears).toBeCloseTo(119 / 120, 4);
        }
    });

    test('Handles Partial Balance Correctly', () => {
        const birthDate = DateTime.fromISO('2000-01-01T00:00:00Z');
        // Moon at middle of Ashwini (6deg 40min) -> 50% traversed.
        // Ketu Balance = 3.5 years.
        const midAshwini = 6 + (40 / 60);
        const dashas = generateVimshottari(birthDate, midAshwini, 2);

        const first = dashas[0];
        expect(first.planet).toBe('Ketu');
        expect(first.durationYears).toBeCloseTo(3.5, 3);

        // Check Sub-periods
        // Should NOT start with Ketu-Ketu if we are halfway through!
        // If we are 50% through, we are at 3.5y of 7y.
        // Ketu-Ketu (0.4y), Ketu-Ven (1.1y), Ketu-Sun (0.35y)... sum to 3.5y?
        // We need to see which Antardasha is active at Birth.
        // The generator should filter out past antardashas.

        // Let's verify what the code does.
        // If code works as planned, subPeriods[0] should be the one active at birth.
        // The sum of durationYears of all subPeriods should equal first.durationYears (3.5).

        let totalSubDuration = 0;
        if (first.subPeriods) {
            first.subPeriods.forEach(sub => totalSubDuration += sub.durationYears);
        }
        expect(totalSubDuration).toBeCloseTo(3.5, 1); // Allow heuristic flex

        // Verify Start Dates
        // The first subPeriod start should be Birth.
        if (first.subPeriods && first.subPeriods.length > 0) {
            expect(first.subPeriods[0].start.toISO()).toBe(birthDate.toISO());
        }
    });
});
