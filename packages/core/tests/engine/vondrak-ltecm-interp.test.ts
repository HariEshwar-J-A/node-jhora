import {
    buildVondrakLtecmSegmentTable,
    maxVondrakOmegaHermiteInterpErrorArcsec,
    maxVondrakOmegaInterpErrorArcsec,
    VONDRAK_LTECM_NODE_DAYS,
    VONDRAK_LTECM_PROOF_NODE_DAYS,
} from '../../src/engine/vondrak-ltecm-interp.js';

const HALF_WINDOW = 250 * 365.25 + 6798.383 / 2;
const Y_MINUS_10K = -1_931_455;
const Y_PLUS_10K = 5_256_455;

describe('Vondrák ltecm matrix interpolation (mean-node)', () => {
    test('32-day Lagrange nodes ≤ 1e-6″ over ±250 yr at deep-era anchors', () => {
        for (const anchor of [Y_MINUS_10K, Y_PLUS_10K]) {
            const jdLo = anchor - HALF_WINDOW;
            const jdHi = anchor + HALF_WINDOW;
            const table = buildVondrakLtecmSegmentTable(
                anchor,
                jdLo,
                jdHi,
                VONDRAK_LTECM_NODE_DAYS,
            );
            const maxErr = maxVondrakOmegaInterpErrorArcsec(
                table,
                jdLo,
                jdHi,
                1,
                1.2e5,
                -3.4e5,
                8.9e4,
            );
            expect(maxErr).toBeLessThanOrEqual(1e-6);
        }
    });

    test('32-day Hermite nodes exceed 1e-6″ (retired path)', () => {
        const anchor = Y_MINUS_10K;
        const jdLo = anchor - HALF_WINDOW;
        const jdHi = anchor + HALF_WINDOW;
        const table = buildVondrakLtecmSegmentTable(
            anchor,
            jdLo,
            jdHi,
            VONDRAK_LTECM_NODE_DAYS,
            true,
        );
        const maxErr = maxVondrakOmegaHermiteInterpErrorArcsec(
            table,
            jdLo,
            jdHi,
            1,
            1.2e5,
            -3.4e5,
            8.9e4,
        );
        expect(maxErr).toBeGreaterThan(1e-6);
    });

    test('1-day Hermite nodes ≤ 1e-6″ over ±250 yr at deep-era anchors', () => {
        for (const anchor of [Y_MINUS_10K, Y_PLUS_10K]) {
            const jdLo = anchor - HALF_WINDOW;
            const jdHi = anchor + HALF_WINDOW;
            const table = buildVondrakLtecmSegmentTable(
                anchor,
                jdLo,
                jdHi,
                VONDRAK_LTECM_PROOF_NODE_DAYS,
                true,
            );
            const maxErr = maxVondrakOmegaHermiteInterpErrorArcsec(
                table,
                jdLo,
                jdHi,
                1,
                1.2e5,
                -3.4e5,
                8.9e4,
            );
            expect(maxErr).toBeLessThanOrEqual(1e-6);
        }
    });
});
