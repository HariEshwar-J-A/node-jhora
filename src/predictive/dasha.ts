import { DateTime } from 'luxon';

// 1. Constants
export const DASHA_DURATIONS: { [key: string]: number } = {
    'Sun': 6,
    'Moon': 10,
    'Mars': 7,
    'Rahu': 18,
    'Jupiter': 16,
    'Saturn': 19,
    'Mercury': 17,
    'Ketu': 7,
    'Venus': 20
};

// Fixed Cyclic Order: Ketu -> Venus -> ...
export const DASHA_ORDER = [
    'Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'
];

export interface DashaPeriod {
    planet: string; // Name of the period (e.g., "Sun" or "Mangala")
    lord?: string;  // Ruling planet (e.g., "Moon" for Mangala)
    level: number; // 1=Maha, 2=Antar, 3=Pratyantar
    start: DateTime;
    end: DateTime;
    durationYears: number; // Decimal years
    subPeriods?: DashaPeriod[];
}

interface DashaBalance {
    lord: string;
    yearsRemaining: number;
    totalDuration: number;
    fractionTraversed: number;
    nakshatraIndex: number;
}

/**
 * Calculates the Balance of Dasha at birth based on Moon's longitude.
 * Nakshatra Span = 360 / 27 = 13deg 20min = 13.3333... degrees.
 */
export function calculateDashaBalance(moonLongitude: number): DashaBalance {
    const NAKSHATRA_SPAN = 360 / 27;

    // Normalize logic just in case, though usually 0-360
    let lon = moonLongitude % 360;
    if (lon < 0) lon += 360;

    const nakshatraIndex = Math.floor(lon / NAKSHATRA_SPAN); // 0..26
    const longitudeInNakshatra = lon % NAKSHATRA_SPAN;
    const fractionTraversed = longitudeInNakshatra / NAKSHATRA_SPAN;

    // Determine Lord. 
    // Ashwini (0) -> Ketu.
    // Order repeats every 9 nakshatras.
    // 0=Ketu, 1=Venus, 2=Sun, 3=Moon, 4=Mars, 5=Rahu, 6=Jup, 7=Sat, 8=Merc
    const lordIndex = nakshatraIndex % 9;
    const lord = DASHA_ORDER[lordIndex];
    const totalDuration = DASHA_DURATIONS[lord];

    const fractionRemaining = 1.0 - fractionTraversed;
    const yearsRemaining = totalDuration * fractionRemaining;

    return {
        lord,
        yearsRemaining,
        totalDuration,
        fractionTraversed,
        nakshatraIndex
    };
}

/**
 * Generates Vimshottari Dasha tree.
 * @param birthDate - Luxon DateTime of birth
 * @param moonLongitude - Moon's longitude
 * @param depth - Recursion depth (1=Maha only, 2=Antar, 3=Pratyantar...)
 */
export function generateVimshottari(birthDate: DateTime, moonLongitude: number, depth: number = 2): DashaPeriod[] {
    const periods: DashaPeriod[] = [];

    // 1. Calculate Start Balance
    const balance = calculateDashaBalance(moonLongitude);

    // Current pointer
    let currentDate = birthDate;

    // Find starting index in DASHA_ORDER
    let currentIndex = DASHA_ORDER.indexOf(balance.lord);

    // We generate 120 years worth of Dashas (some texts say 120, others say life span).
    // Let's generate one full cycle of 120 years starting from birth + balance.
    // Actually, usually we list the full Mahadasha sequence covering a reasonable human lifespan (e.g. 120 years from birth).

    // First Mahadasha (Partial)
    // It starts at Birth, lasts for yearsRemaining.
    // But conceptually, the Mahadasha started `(Total - Remaining)` years BEFORE birth.
    // The "End Date" of the first Dasha is Birth + Balance.

    let yearsCovered = 0;
    const targetYears = 120; // Generate 120 years from birth

    // Loop through planets in cycle
    while (yearsCovered < targetYears) {
        const planet = DASHA_ORDER[currentIndex % 9];
        const fullDuration = DASHA_DURATIONS[planet];

        let actualDuration = fullDuration;

        // Handle the first Dasha (Balance)
        if (periods.length === 0) {
            actualDuration = balance.yearsRemaining;
        }

        const endDate = currentDate.plus({ years: actualDuration }); // Luxon handles float years? No, usually not precise.
        // Precision Note: Luxon plus({ years: 5.5 }) might work or trunc.
        // Better to convert years to milliseconds or days for precision.
        // 1 Sidereal Year ~ 365.25636 days? 
        // Standard Dasha Year is usually user-selectable (Savana=360, Solar=365.25...).
        // Let's use Gregorian mean year (365.2425 days) simplistically or Luxon's standard year.
        // For astrological precision, we often calculate exact dates.
        // Let's use milliseconds: Duration * 365.242199 * 24 * 3600 * 1000.
        // Or simply let Luxon handle it: .plus({ years: x }) is calendar years.
        // Using Calendar Years is standard for most generic Dasha displays.
        // BUT for 'Balance', it's a fraction. 
        // 0.5 years = 6 months.

        const start = currentDate;
        // Calculation using millis for better fraction support
        const MS_PER_YEAR = 31557600000; // 365.25 days * 24 * 3600 * 1000 (Julian Year approx)
        const durationMs = actualDuration * MS_PER_YEAR;
        const end = start.plus({ milliseconds: durationMs });

        const mahaDasha: DashaPeriod = {
            planet,
            level: 1,
            start,
            end,
            durationYears: actualDuration,
            subPeriods: []
        };

        // Generate Subperiods
        if (depth >= 2) {
            mahaDasha.subPeriods = generateSubPeriods(mahaDasha, fullDuration, depth, 2);
        }

        periods.push(mahaDasha);

        currentDate = end;
        yearsCovered += actualDuration;
        currentIndex++;
    }

    return periods;
}

/**
 * Recursive helper for Sub-periods (Antar, Pratyantar, etc.)
 * @param parentPeriod - The parent period
 * @param parentFullDurationYears - The full duration of the parent planet (standard years), unrelated to balance.
 * e.g. If Sun Mahadasha (6y), we use 6. Even if it's a balance of 2y.
 * Note: For the First Mahadasha (Balance), the Antardashas are tricky.
 * Standard Logic: If born with 2y Sun remaining (out of 6), we are in a specific Antardasha.
 * We should calculate the Full Mahadasha structure relative to its conceptual start, then Filter/Clip to birth?
 * Or just generate the sub-periods that fit in the remaining time?
 * Correct Approach: Find the Conceptual Start of the Mahadasha (Birth - Traversed).
 * Generate all Antardashas from that Start.
 * Filter out those that end before Birth.
 * Clip the one that overlaps Birth.
 */
function generateSubPeriods(parent: DashaPeriod, parentStandardDuration: number, maxDepth: number, currentDepth: number): DashaPeriod[] {
    // 1. Determine Start of this sequence
    // If this is a normal period, Start = parent.start.
    // If this is the First Mahadasha (Balance), parent.start is Birth.
    // But the Cycle actually started `Traversed` years ago.
    // We need to know if this Parent is a "Balance" period.
    // Heuristic: If parent.durationYears != parentStandardDuration (approx), it's a partial.
    // Actually, simpler to pass an offset or "start date of cycle".

    // Let's keep it simple for MVP Phase 6:
    // Just generate the sub-periods proportionally for the *start* of the period?
    // No, Antardashas follow a fixed order starting from the Mahadasha Lord.
    // Example: Sun Mahadasha always starts with Sun-Sun, then Sun-Moon...
    // If we are born in Sun-Mars, we should list Sun-Mars (partial), then Sun-Rahu, etc.

    // Workaround for Balance Period:
    // 1. Calculate "Traversed Years" = Standard - Actual.
    // 2. Conceptual Start = Parent.Start - Traversed.
    // 3. Generate all 9 sub-periods from Conceptual Start.
    // 4. Return valid filter.

    const traversedYears = parentStandardDuration - parent.durationYears;
    // Allow small epsilon for floating point equality
    const isPartial = Math.abs(traversedYears) > 0.0001;

    const MS_PER_YEAR = 31557600000;

    let conceptualStart = parent.start;
    if (isPartial) {
        conceptualStart = parent.start.minus({ milliseconds: traversedYears * MS_PER_YEAR });
    }

    const subPeriods: DashaPeriod[] = [];

    // The first sub-period Lord is the Parent Lord.
    // Cycle: Parent -> ... -> ...
    const parentLordIdx = DASHA_ORDER.indexOf(parent.planet);

    let currentP = conceptualStart;

    for (let i = 0; i < 9; i++) {
        const subLord = DASHA_ORDER[(parentLordIdx + i) % 9];
        const subLordDurationStandard = DASHA_DURATIONS[subLord];

        // Formula: (Major * Sub) / 120
        const subDurationYears = (parentStandardDuration * subLordDurationStandard) / 120;
        const subDurationMs = subDurationYears * MS_PER_YEAR;
        const subEnd = currentP.plus({ milliseconds: subDurationMs });

        // Logic to include/clip
        // If subEnd is before parent.start (Birth), skip.
        // If subEnd is after parent.start, include.
        // Start should be max(currentP, parent.start).

        if (subEnd > parent.start) {
            const actualStart = (currentP < parent.start) ? parent.start : currentP;
            // Use consistent MS math for duration to avoid Calendar Year (365/366) jitter
            const actualDuration = subEnd.diff(actualStart).toMillis() / MS_PER_YEAR;

            const subPeriod: DashaPeriod = {
                planet: subLord,
                level: currentDepth,
                start: actualStart,
                end: subEnd,
                durationYears: actualDuration,
                subPeriods: []
            };

            // Recursion for Level 3 (Pratyantar)
            if (currentDepth < maxDepth) {
                // For Pratyantar, use similar logic?
                // Usually Level 3 logic is (Sub * SubSub) / 120 relative to Sub duration?
                // No, standard rule: (Maha * Antar * Pratyantar) / (120*120)? 
                // Or simply recursive: Treat Antar as "Maha" with duration X?
                // Formula: (MahaY * AntarY * PratY) / (120*120)?? No.
                // Recursive Rule: SubPeriod = (ParentStandard * ChildStandard) / 120.
                // Yes, works naturally if we pass ParentStandardDuration.
                subPeriod.subPeriods = generateSubPeriods(subPeriod, subDurationYears, maxDepth, currentDepth + 1);
            }

            subPeriods.push(subPeriod);
        }

        currentP = subEnd;
    }

    return subPeriods;
}
