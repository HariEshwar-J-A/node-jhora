import {
    calculateDigBala,
    calculateNatonataBala,
    calculatePakshaBala,
    calculateTribhagaBala,
    calculateAyanabala,
    calculateChestaBala
} from '../../src/shadbala_time.js';
import { PlanetPosition } from '@node-jhora/core';

describe('Shadbala - Dig, Kaala, Chesta', () => {

    describe('Dig Bala (Directional)', () => {
        // Sun Power Point: South (MC).
        test('Sun at MC gets 60', () => {
            const planet = { id: 0, longitude: 180 } as PlanetPosition;
            const asc = 90; // East
            const mc = 180; // South
            expect(calculateDigBala(planet, asc, mc)).toBe(60);
        });

        test('Saturn (West) at Descendant gets 60', () => {
            const planet = { id: 6, longitude: 270 } as PlanetPosition;
            const asc = 90; // East
            const mc = 180;
            // West = Asc + 180 = 270.
            expect(calculateDigBala(planet, asc, mc)).toBe(60);
        });

        test('Jupiter (East) at MC (90 deg away)', () => {
            const planet = { id: 5, longitude: 180 } as PlanetPosition; // At South
            const asc = 90; // East
            const mc = 180;
            // Dist Jup(180) to Asc(90) = 90.
            // Score = 60 - 90/3 = 60 - 30 = 30.
            expect(calculateDigBala(planet, asc, mc)).toBe(30);
        });
    });

    describe('Kaala Bala', () => {
        // Natonata
        test('Natonata: Sun at Noon (MC) gets 60', () => {
            const sunLon = 180;
            const mcLon = 180;
            expect(calculateNatonataBala(0, sunLon, mcLon)).toBe(60);
        });

        test('Natonata: Moon at Midnight (IC) gets 60', () => {
            const sunLon = 0; // Midnight (IC)
            const mcLon = 180; // Noon
            // Moon (1) is Midnight Strong.
            // If Sun is at IC (Midnight), Moon gets Max Strength? 
            // Formula depends on TIME (Sun position).
            // If Sun is at IC (Midnight), then Time is Midnight.
            // Moon gets 60.
            expect(calculateNatonataBala(1, sunLon, mcLon)).toBe(60);
        });

        // Paksha
        test('Paksha: Benifics Max at Full Moon', () => {
            const sunLon = 0;
            const moonLon = 180; // Full Moon
            // Jupiter (Benefic) should get 60
            expect(calculatePakshaBala(5, sunLon, moonLon)).toBe(60);
        });

        test('Paksha: Malefics Max at New Moon', () => {
            const sunLon = 0;
            const moonLon = 10; // Near New Moon
            // Saturn (Malefic) should get High Score
            // Dist = 10. Benefic = 3.333. Malefic = 60 - 3.333 = 56.666
            expect(calculatePakshaBala(6, sunLon, moonLon)).toBeCloseTo(56.67);
        });

        // Tribhaga
        test('Tribhaga: Jupiter always 60', () => {
            expect(calculateTribhagaBala(5, 12, 6, 18)).toBe(60);
        });

        test('Tribhaga: Sun (Day 2 Lord) at Noon', () => {
            // Noon (12) is part 2 of Day (6-18).
            // Part 1: 6-10 (Merc). Part 2: 10-14 (Sun).
            expect(calculateTribhagaBala(0, 12, 6, 18)).toBe(60);
        });

        // Ayanabala
        test('Ayanabala: Sun (North) at +23 Declination', () => {
            // (24 + 23) * 1.25 = 47 * 1.25 = 58.75
            expect(calculateAyanabala(0, 23)).toBe(58.75);
        });

        test('Ayanabala: Moon (South) at -23 Declination', () => {
            // (24 - (-23)) * 1.25 = 47 * 1.25 = 58.75
            expect(calculateAyanabala(1, -23)).toBe(58.75);
        });
    });

    describe('Chesta Bala', () => {
        test('Retrograde Planet gets 60', () => {
            const p = { id: 4, speed: -0.5 } as PlanetPosition;
            expect(calculateChestaBala(p)).toBe(60);
        });

        test('Stationary Planet gets 15', () => {
            const p = { id: 4, speed: 0.0001 } as PlanetPosition;
            expect(calculateChestaBala(p)).toBe(15);
        });

        test('Sun/Moon get 0', () => {
            const p = { id: 0, speed: 1.0 } as PlanetPosition;
            expect(calculateChestaBala(p)).toBe(0);
        });
    });
});
