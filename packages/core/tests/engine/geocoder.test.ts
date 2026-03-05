import { Geocoder } from '../../src/engine/geocoder.js';

describe('Geocoder (Browser Stub)', () => {
    let geocoder: Geocoder;

    beforeAll(() => {
        geocoder = new Geocoder();
    });

    test('throws in non-browser environment (stub behaviour)', async () => {
        await expect(geocoder.searchCity('Chennai')).rejects.toThrow(
            'Geocoder is not available in browser environments'
        );
    });

    test('stub always throws for any query', async () => {
        await expect(geocoder.searchCity('London')).rejects.toThrow();
    });

    test('stub throws for unknown city too', async () => {
        await expect(geocoder.searchCity('Atlantis')).rejects.toThrow();
    });
});
