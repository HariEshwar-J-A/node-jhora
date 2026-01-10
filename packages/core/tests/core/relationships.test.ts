import { getRelationship, getTatkalikaMaitri, getPanchadhaMaitri, NAISARGIKA_MAITRI, Relationship } from '../../src/core/relationships.js';

describe('Planetary Relationships (Maitri)', () => {
    describe('Naisargika (Natural)', () => {
        const SUN = 0;
        const MOON = 1;
        const SATURN = 6;

        test('Sun Friends/Enemies', () => {
            const sunData = NAISARGIKA_MAITRI[SUN];
            expect(sunData.friends).toContain(MOON);
            expect(sunData.enemies).toContain(SATURN);
        });

        test('Moon has no enemies', () => {
            const moonData = NAISARGIKA_MAITRI[MOON];
            expect(moonData.enemies.length).toBe(0);
        });
    });

    describe('Tatkalika (Temporary)', () => {
        test('2nd House is Friend', () => {
            // Sun in Aries (1), Moon in Taurus (2) -> Friend
            expect(getTatkalikaMaitri(1, 2)).toBe('Friend');
        });

        test('1st House is Enemy', () => {
            // Sun in Aries (1), Moon in Aries (1) -> Enemy
            expect(getTatkalikaMaitri(1, 1)).toBe('Enemy');
        });

        test('10th House is Friend', () => {
            // Sun in Aries (1), Moon in Capricorn (10) -> Friend
            expect(getTatkalikaMaitri(1, 10)).toBe('Friend');
        });

        test('7th House is Enemy', () => {
            // Sun in Aries (1), Moon in Libra (7) -> Enemy
            expect(getTatkalikaMaitri(1, 7)).toBe('Enemy');
        });
    });

    describe('Panchadha (Compound)', () => {
        test('Friend + Friend = Great Friend', () => {
            expect(getPanchadhaMaitri('Friend', 'Friend')).toBe(Relationship.GreatFriend);
        });

        test('Friend + Enemy = Neutral', () => {
            expect(getPanchadhaMaitri('Friend', 'Enemy')).toBe(Relationship.Neutral);
        });

        test('Neutral + Friend = Friend', () => {
            expect(getPanchadhaMaitri('Neutral', 'Friend')).toBe(Relationship.Friend);
        });

        test('Enemy + Enemy = Great Enemy', () => {
            expect(getPanchadhaMaitri('Enemy', 'Enemy')).toBe(Relationship.GreatEnemy);
        });
    });

    describe('Integration', () => {
        const SUN = 0;
        const MOON = 1;
        const SATURN = 6;

        test('Sun (1) vs Moon (2) -> Great Friend', () => {
            // Natural: Sun -> Moon is Friend
            // Temp: 2nd house is Friend
            // Result: Great Friend
            expect(getRelationship(SUN, 1, MOON, 2)).toBe(Relationship.GreatFriend);
        });

        test('Sun (1) vs Saturn (1) -> Great Enemy', () => {
            // Natural: Sun -> Sat is Enemy
            // Temp: 1st house is Enemy
            // Result: Great Enemy
            expect(getRelationship(SUN, 1, SATURN, 1)).toBe(Relationship.GreatEnemy);
        });
    });
});
