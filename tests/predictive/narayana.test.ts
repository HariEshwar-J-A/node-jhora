
import { NarayanaDasha } from '../../src/predictive/narayana.js';
import { ChartData } from '../../src/yogas/engine.js';
import { DateTime } from 'luxon';

describe('Narayana Dasha', () => {
    
    // Mock Chart Data
    const mockPlanets = [
        { id: 99, longitude: 15, name: 'Ascendant', speed: 1 }, // Aries (Odd)
        { id: 4, longitude: 45, name: 'Mars', speed: 1 }, // Taurus
        { id: 6, longitude: 280, name: 'Saturn', speed: 1 } // Capricorn
    ];
    // Ascendant (99) is at 15 deg -> Aries (Sign 1).
    // Aries is ODD.
    // Saturn is NOT in Lagna.
    // Order should be Forward: 1, 2, 3...

    const mockChart: ChartData = {
        planets: mockPlanets,
        houses: { ascendant: { sign: 1, longitude: 15 } } as any,
        ayanamsa: 0
    };

    test('Standard Forward Sequence (Odd Lagna - Aries)', () => {
        const dashas = NarayanaDasha.calculate(mockChart, DateTime.now(), 50);
        
        expect(dashas[0].signIndex).toBe(1); // Aries
        expect(dashas[1].signIndex).toBe(2); // Taurus
        expect(dashas[2].signIndex).toBe(3); // Gemini
        expect(dashas[0].isForward).toBe(true);
    });

    test('Saturn Exception (Saturn in Lagna)', () => {
        // Move Saturn to Aries (10 deg)
        const planetsSat = [
            { id: 99, longitude: 15, name: 'Ascendant', speed: 1 },
            { id: 6, longitude: 10, name: 'Saturn', speed: 1 } // Aries
        ];
        const chartSat: ChartData = {
            planets: planetsSat,
            houses: { ascendant: { sign: 1, longitude: 15 } } as any,
            ayanamsa: 0
        };

        // Lagna Aries (Odd) -> Normally Forward.
        // But Saturn is in Lagna -> Reverse.
        const dashas = NarayanaDasha.calculate(chartSat, DateTime.now(), 50);

        expect(dashas[0].signIndex).toBe(1); // Aries
        expect(dashas[1].signIndex).toBe(12); // Pisces (Reverse)
        expect(dashas[2].signIndex).toBe(11); // Aquarius
    });

    test('Even Lagna (Taurus) -> Reverse', () => {
        const planetsEven = [ { id: 99, longitude: 45, name: 'Ascendant', speed: 1 } ]; // Taurus
        const chartEven: ChartData = {
            planets: planetsEven,
            houses: { ascendant: { sign: 2, longitude: 45 } } as any,
            ayanamsa: 0
        };

        const dashas = NarayanaDasha.calculate(chartEven, DateTime.now(), 50);
        
        expect(dashas[0].signIndex).toBe(2); // Taurus
        expect(dashas[1].signIndex).toBe(1); // Aries (Reverse)
        expect(dashas[2].signIndex).toBe(12); // Pisces
    });
});
