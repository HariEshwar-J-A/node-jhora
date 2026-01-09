import { Geocoder } from '../../src/engine/geocoder.js';

describe('Geocoder (Pure JS)', () => {
    let geocoder: Geocoder;

    beforeAll(() => {
        geocoder = new Geocoder();
    });

    test('finds a known city (exact match)', async () => {
        const result = await geocoder.searchCity('Chennai');
        expect(result).not.toBeNull();
        expect(result?.name).toBe('Chennai');
        expect(result?.country).toBe('India');
        expect(result?.latitude).toBeCloseTo(13.0827);
        expect(result?.timezone).toBe('Asia/Kolkata');
    });

    test('finds a city case-insensitive', async () => {
        const result = await geocoder.searchCity('london');
        expect(result).not.toBeNull();
        expect(result?.name).toBe('London');
        expect(result?.latitude).toBeCloseTo(51.5074);
    });

    test('returns null for unknown city', async () => {
        const result = await geocoder.searchCity('Atlantis');
        expect(result).toBeNull();
    });
});
