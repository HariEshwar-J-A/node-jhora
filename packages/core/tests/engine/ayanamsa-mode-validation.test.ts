import {
    assertValidAyanamsaMode,
    getAyanamsa,
    UnknownAyanamsaModeError,
    UnsupportedAyanamsaModeError,
} from '../../src/engine/ayanamsa.js';
import { EphemerisEngine } from '../../src/engine/ephemeris.js';
import { CalculationSettingsSchema } from '../../src/settings/schema.js';

const JD = 2451545.0;

describe('ayanamsa mode validation', () => {
    test('mode 30 (Gil Brand) is registered', () => {
        expect(() => getAyanamsa(30, JD)).not.toThrow();
    });

    test.each([
        [99, UnknownAyanamsaModeError],
        [-1, UnknownAyanamsaModeError],
    ])('mode %i throws', (mode, errorType) => {
        expect(() => getAyanamsa(mode, JD)).toThrow(errorType);
        expect(() => assertValidAyanamsaMode(mode)).toThrow(errorType);
    });

    test('USER mode 255 requires options.user', () => {
        expect(() => getAyanamsa(255, JD)).toThrow(/requires options\.user/);
    });

    test('non-finite and non-integer modes throw UnknownAyanamsaModeError', () => {
        expect(() => assertValidAyanamsaMode(Number.NaN)).toThrow(UnknownAyanamsaModeError);
        expect(() => assertValidAyanamsaMode(1.5)).toThrow(UnknownAyanamsaModeError);
    });

    test('EphemerisEngine.setAyanamsa rejects unknown modes', async () => {
        const engine = EphemerisEngine.getInstance();
        await engine.initialize();
        expect(() => engine.setAyanamsa(99)).toThrow(UnknownAyanamsaModeError);
        expect(() => engine.setAyanamsa(7)).not.toThrow();
        expect(() => engine.setAyanamsa(30)).not.toThrow();
    });

    test('CalculationSettingsSchema rejects customAyanamsaMode 99', () => {
        const result = CalculationSettingsSchema.safeParse({
            schemaVersion: 1,
            ayanamsa: 'lahiri',
            ayanamsaOffsetDeg: 0,
            customAyanamsaMode: 99,
            nodeType: 'true',
            houseSystem: 'whole_sign',
            cuspsInMiddle: false,
            positionMode: 'geometric',
            topocentric: false,
            altitudeMetres: 0,
            sunrise: { limb: 'disc_centre', refraction: false, nominalHour: 6 },
            dasaYear: { kind: 'tropical', days: 365.256364 },
            dasamsaScheme: 'parashara',
            horaScheme: 'parashara',
            vargaVariants: {},
        });
        expect(result.success).toBe(false);
    });
});
