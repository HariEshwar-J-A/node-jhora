/**
 * Golden Standard: Vimshottari Dasha Engine
 *
 * Validates the Dasha balance calculation and period generation.
 * Key constants:
 *   - Dasha Year = 365.242189623 days (Tropical Year, pyjhora standard)
 *   - Nakshatra Span = 360/27 (exact)
 *   - Total cycle = 120 years
 *
 * After the Decimal.js refactor, date precision should be within 1 day
 * for a 120-year span.
 */
import { DateTime } from 'luxon';
import {
    calculateDashaBalance,
    generateVimshottari,
    DASHA_DURATIONS,
    DASHA_ORDER,
    type DashaPeriod,
} from '../../src/dasha.js';

describe('Golden: Vimshottari Dasha', () => {

    // ---------------------------------------------------------------------------
    // Balance calculation
    // ---------------------------------------------------------------------------
    describe('Dasha Balance at Birth', () => {

        test('0° (start Ashwini) → Ketu, full 7y remaining', () => {
            const b = calculateDashaBalance(0);
            expect(b.lord).toBe('Ketu');
            expect(b.yearsRemaining).toBeCloseTo(7, 4);
            expect(b.fractionTraversed).toBeCloseTo(0, 6);
            expect(b.totalDuration).toBe(7);
        });

        test('13.333° (end Ashwini) → Ketu, ~0y remaining', () => {
            const span = 360 / 27;
            const b = calculateDashaBalance(span - 0.0001);
            expect(b.lord).toBe('Ketu');
            expect(b.yearsRemaining).toBeCloseTo(0, 2);
        });

        test('13.334° (start Bharani) → Venus, ~full 20y remaining', () => {
            const b = calculateDashaBalance(13.334);
            expect(b.lord).toBe('Venus');
            // 13.334 is ~0.001° into Bharani; fractional traversal ~0.000050
            // yearsRemaining ≈ 19.999, accept within 0.05y
            expect(b.yearsRemaining).toBeCloseTo(20, 1);
        });

        test('midpoint Ashwini (6°40\') → Ketu, 3.5y remaining', () => {
            const b = calculateDashaBalance(6 + 40/60);
            expect(b.lord).toBe('Ketu');
            expect(b.yearsRemaining).toBeCloseTo(3.5, 3);
            expect(b.fractionTraversed).toBeCloseTo(0.5, 4);
        });

        // Chart B Moon at 17.549° (Bharani sign, ~30.7% traversed of Bharani)
        // Bharani starts at 13.333°, span = 13.333°, traversed = 17.549 - 13.333 = 4.216°
        // fraction = 4.216 / 13.333 = 0.3162
        // remaining = (1 - 0.3162) * 20 = 13.676y
        test('Chart B Moon (17.549°) → Venus, ~13.68y remaining', () => {
            const b = calculateDashaBalance(17.549);
            expect(b.lord).toBe('Venus');
            expect(b.yearsRemaining).toBeCloseTo(13.676, 1);
        });

        test('Nakshatra index mapping — all 27 covered', () => {
            const span = 360 / 27;
            for (let i = 0; i < 27; i++) {
                const lon = i * span + span / 2; // mid of each nakshatra
                const b = calculateDashaBalance(lon);
                expect(DASHA_ORDER).toContain(b.lord);
                expect(b.yearsRemaining).toBeGreaterThan(0);
                expect(b.yearsRemaining).toBeLessThanOrEqual(DASHA_DURATIONS[b.lord]);
            }
        });
    });

    // ---------------------------------------------------------------------------
    // Mahadasha tree
    // ---------------------------------------------------------------------------
    describe('Mahadasha sequence', () => {
        const birth = DateTime.fromISO('2000-01-01T00:00:00Z');

        test('Full Ketu start → 9 Mahadashas in correct order', () => {
            const dashas = generateVimshottari(birth, 0, 1);
            // Must start with Ketu (7y), then Venus (20y), ...
            expect(dashas[0].planet).toBe('Ketu');
            expect(dashas[1].planet).toBe('Venus');
            expect(dashas[2].planet).toBe('Sun');
            expect(dashas[3].planet).toBe('Moon');
            expect(dashas[4].planet).toBe('Mars');
            expect(dashas[5].planet).toBe('Rahu');
            expect(dashas[6].planet).toBe('Jupiter');
            expect(dashas[7].planet).toBe('Saturn');
            expect(dashas[8].planet).toBe('Mercury');
        });

        test('Ketu Mahadasha lasts exactly 7 years (within 1 day)', () => {
            const dashas = generateVimshottari(birth, 0, 1);
            const ketu = dashas[0];
            expect(ketu.durationYears).toBeCloseTo(7, 3);
        });

        test('Venus Mahadasha starts immediately after Ketu ends', () => {
            const dashas = generateVimshottari(birth, 0, 1);
            const ketuEnd   = dashas[0].end.toMillis();
            const venusStart = dashas[1].start.toMillis();
            expect(Math.abs(ketuEnd - venusStart)).toBeLessThan(1000); // within 1 second
        });

        test('Sum of all Mahadashas ≈ 120 years', () => {
            const dashas = generateVimshottari(birth, 0, 1);
            const totalDays = dashas[dashas.length - 1].end.diff(birth, 'days').days;
            expect(totalDays).toBeCloseTo(120 * 365.242189623, -1); // within ~10 days
        });

        test('Partial balance: first Dasha < standard duration', () => {
            const b = calculateDashaBalance(6 + 40/60); // 3.5y Ketu balance
            const dashas = generateVimshottari(birth, 6 + 40/60, 1);
            expect(dashas[0].durationYears).toBeCloseTo(b.yearsRemaining, 2);
        });
    });

    // ---------------------------------------------------------------------------
    // Antardasha (depth=2)
    // ---------------------------------------------------------------------------
    describe('Antardasha', () => {
        const birth = DateTime.fromISO('2000-01-01T00:00:00Z');

        test('Ketu Mahadasha has 9 Antardashas', () => {
            const dashas = generateVimshottari(birth, 0, 2);
            expect(dashas[0].subPeriods?.length).toBe(9);
        });

        test('Ketu-Ketu Antardasha duration = 7*7/120 years', () => {
            const dashas = generateVimshottari(birth, 0, 2);
            const ketuKetu = dashas[0].subPeriods![0];
            expect(ketuKetu.planet).toBe('Ketu');
            expect(ketuKetu.durationYears).toBeCloseTo(49 / 120, 4);
        });

        test('Ketu-Venus Antardasha duration = 7*20/120 years', () => {
            const dashas = generateVimshottari(birth, 0, 2);
            const ketuVenus = dashas[0].subPeriods![1];
            expect(ketuVenus.planet).toBe('Venus');
            expect(ketuVenus.durationYears).toBeCloseTo(140 / 120, 4);
        });

        test('Ketu-Mercury Antardasha duration = 7*17/120 years', () => {
            const dashas = generateVimshottari(birth, 0, 2);
            const ketuMerc = dashas[0].subPeriods![8];
            expect(ketuMerc.planet).toBe('Mercury');
            expect(ketuMerc.durationYears).toBeCloseTo(119 / 120, 4);
        });

        test('Sum of Ketu antardashas = Ketu mahadasha duration', () => {
            const dashas = generateVimshottari(birth, 0, 2);
            const ketuMaha = dashas[0];
            const sum = ketuMaha.subPeriods!.reduce((acc, sp) => acc + sp.durationYears, 0);
            expect(sum).toBeCloseTo(ketuMaha.durationYears, 3);
        });

        test('Partial balance: sum of filtered antardashas = balance years', () => {
            const moon = 6 + 40/60; // 3.5y Ketu balance
            const dashas = generateVimshottari(birth, moon, 2);
            const ketuMaha = dashas[0];
            const sum = ketuMaha.subPeriods!.reduce((acc, sp) => acc + sp.durationYears, 0);
            expect(sum).toBeCloseTo(ketuMaha.durationYears, 1);
        });

        test('Antardasha start dates are contiguous', () => {
            const dashas = generateVimshottari(birth, 0, 2);
            const subs = dashas[0].subPeriods!;
            for (let i = 1; i < subs.length; i++) {
                const prevEnd = subs[i-1].end.toMillis();
                const curStart = subs[i].start.toMillis();
                expect(Math.abs(prevEnd - curStart)).toBeLessThan(1000);
            }
        });
    });
});
