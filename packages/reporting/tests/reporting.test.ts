import { generateFullReport } from '../src/index.js';
import { PlanetPosition } from '@node-jhora/core';
import { ChartData } from '@node-jhora/analytics';

describe('Reporting Engine', () => {
    // Mock Chart Data
    const mockPlanets: PlanetPosition[] = [
        { id: 0, name: 'Sun', longitude: 10, latitude: 0, distance: 1, speed: 1 },
        { id: 1, name: 'Moon', longitude: 45, latitude: 0, distance: 1, speed: 12 },
        { id: 2, name: 'Mars', longitude: 280, latitude: 0, distance: 1, speed: 0.5 },
        { id: 4, name: 'Jupiter', longitude: 100, latitude: 0, distance: 5, speed: 0.1 }
    ];

    const mockChart: ChartData = {
        planets: mockPlanets,
        cusps: new Array(12).fill(0).map((_, i) => i * 30),
        ascendant: 0 // Aries Lagna
    };

    test('generateFullReport should return a valid PDF Buffer', async () => {
        try {
            const buffer = await generateFullReport(mockChart, {
                subjectName: 'Test Subject',
                birthDate: '2025-01-01T12:00:00Z',
                birthPlace: 'New Delhi',
                chartStyle: 'South'
            });

            expect(buffer).toBeDefined();
            expect(Buffer.isBuffer(buffer)).toBe(true);
            expect(buffer.length).toBeGreaterThan(100);
        } catch (e: any) {
            console.error('Test Failed Exception:', e);
            throw e;
        }
    });

    test('generateFullReport with North Indian style', async () => {
        const buffer = await generateFullReport(mockChart, {
            subjectName: 'Test North',
            chartStyle: 'North'
        });
        expect(buffer.length).toBeGreaterThan(100);
    });
});
