import { eraDtdbGeocenterSeconds } from '../../src/engine/dtdb-erfa.js';

/** Cross-check against pyerfa 2.0.1.5 eraDtdb (geocentre, TT date). */
const PYERFA_DTDB_SEC = [
    { jdTT: 2451545.0, sec: -9.930719894379447e-5 },
    { jdTT: 2396753.00037037, sec: -0.00014694835386410874 },
    { jdTT: 2506352.000752315, sec: 0.00044702117367587357 },
];

describe('eraDtdbGeocenterSeconds', () => {
    for (const { jdTT, sec } of PYERFA_DTDB_SEC) {
        test(`matches pyerfa at JD(TT) ${jdTT}`, () => {
            expect(eraDtdbGeocenterSeconds(jdTT)).toBeCloseTo(sec, 15);
        });
    }
});
