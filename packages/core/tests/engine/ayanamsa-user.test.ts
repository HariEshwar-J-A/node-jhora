import { AYANAMSA_MODE_USER, AYANAMSA_FLAGS, getAyanamsa } from '../../src/engine/ayanamsa.js';

const JD = 2451545.0;
const t0 = 2415020.0;

describe('USER ayanamsa (mode 255)', () => {
    test('returns anchor value at t0', () => {
        expect(
            getAyanamsa(AYANAMSA_MODE_USER, t0, 'apparent', 'modern', {
                user: { t0Jd: t0, ayanamsaDeg: 23.5 },
            }),
        ).toBeCloseTo(23.5, 10);
    });

    test('ORIGINAL_PRECESSION flag is accepted on Lahiri', () => {
        const jd = 2451545.0;
        const withFlag = getAyanamsa(1, jd, 'apparent', 'modern', {
            ayanamsaFlags: AYANAMSA_FLAGS.ORIGINAL_PRECESSION,
        });
        const jhora = getAyanamsa(1, jd, 'apparent', 'jhora');
        expect(withFlag).toBeCloseTo(jhora, 8);
    });
});
