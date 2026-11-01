/**
 * Engine ayanamsa mode numbers must match pyswisseph 2.10 identifiers.
 * Values are API constants only — not copied from Swiss Ephemeris source.
 */

import {
    AYANAMSA_MODELS,
    UnsupportedAyanamsaModeError,
    UNSUPPORTED_AYANAMSA_MODES,
    getAyanamsa,
} from '../../src/engine/ayanamsa.js';
import { AYANAMSA } from '../../src/engine/ephemeris.js';

/** pyswisseph 2.10.03 `SIDM_*` integers (probed once; not read from SE source). */
const PY_SWISSEPH_SIDM: Record<string, number> = {
    FAGAN_BRADLEY: 0,
    LAHIRI: 1,
    DELUCE: 2,
    RAMAN: 3,
    KRISHNAMURTI: 5,
    YUKTESHWAR: 7,
    JN_BHASIN: 8,
    J2000: 18,
    TRUE_CITRA: 27,
    TRUE_PUSHYA: 29,
    TRUE_REVATI: 28,
    TRUE_MULA: 35,
    LAHIRI_ICRC: 46,
};

const ENGINE_BY_NAME: Record<string, number> = {
    FAGAN_BRADLEY: AYANAMSA.FAGAN_BRADLEY,
    LAHIRI: AYANAMSA.LAHIRI,
    DELUCE: AYANAMSA.DE_LUCE,
    RAMAN: AYANAMSA.RAMAN,
    KRISHNAMURTI: AYANAMSA.KRISHNAMURTI,
    YUKTESHWAR: AYANAMSA.YUKTESHWAR,
    JN_BHASIN: AYANAMSA.JN_BHASIN,
    J2000: AYANAMSA.J2000,
    TRUE_CITRA: AYANAMSA.TRUE_CITRA,
    TRUE_PUSHYA: AYANAMSA.TRUE_PUSHYA,
    TRUE_REVATI: AYANAMSA.TRUE_REVATI,
    TRUE_MULA: AYANAMSA.TRUE_MULA,
    LAHIRI_ICRC: AYANAMSA.LAHIRI_ICRC,
};

describe('ayanamsa mode numbers (pyswisseph 2.10)', () => {
    for (const [name, seId] of Object.entries(PY_SWISSEPH_SIDM)) {
        test(`${name} = ${seId}`, () => {
            expect(ENGINE_BY_NAME[name]).toBe(seId);
            if (UNSUPPORTED_AYANAMSA_MODES.has(seId)) {
                expect(AYANAMSA_MODELS[seId]).toBeUndefined();
                expect(() => getAyanamsa(seId, 2451545.0)).toThrow(UnsupportedAyanamsaModeError);
            } else if (seId === 255) {
                expect(() => getAyanamsa(seId, 2451545.0)).toThrow(/requires options\.user/);
            } else {
                expect(AYANAMSA_MODELS[seId]).toBeDefined();
            }
        });
    }
});
