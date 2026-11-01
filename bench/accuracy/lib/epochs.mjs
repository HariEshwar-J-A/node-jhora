/**
 * Sample UTC epochs for cross-library accuracy runs.
 * JD ranges follow DE440 (≈1550–2650 CE) vs DE441 elsewhere (see ADR 0024).
 */

/** @typedef {{ id: string; label: string; jdMin: number; jdMax: number; count: number; kernel: 'de440'|'de441'|'auto' }} EraSpec */

/** Gregorian calendar year → JD at 0h UT (proleptic). */
export function jdFromGregorianYear(year, month = 7, day = 1) {
    const a = Math.floor((14 - month) / 12);
    const y = year + 4800 - a;
    const m = month + 12 * a - 3;
    return (
        day +
        Math.floor((153 * m + 2) / 5) +
        365 * y +
        Math.floor(y / 4) -
        Math.floor(y / 100) +
        Math.floor(y / 400) -
        32045 -
        0.5
    );
}

/**
 * @param {number} jdMin
 * @param {number} jdMax
 * @param {number} count
 */
export function uniformJdSamples(jdMin, jdMax, count) {
    if (count <= 1) return [0.5 * (jdMin + jdMax)];
    const out = [];
    for (let i = 0; i < count; i++) {
        const t = i / (count - 1);
        out.push(jdMin + t * (jdMax - jdMin));
    }
    return out;
}

/** DE440 validity in JD(UT) per JPL NAIF coverage notes (1550–2650 CE). */
export const DE440_JD_MIN = jdFromGregorianYear(1550, 1, 1);
export const DE440_JD_MAX = jdFromGregorianYear(2650, 1, 1);

/** DE441 long-span validity (Julian years −13200 … +17191). */
export const DE441_JD_MIN = jdFromGregorianYear(-12999, 1, 1);
export const DE441_JD_MAX = jdFromGregorianYear(17190, 1, 1);

/**
 * @param {boolean} quick Smaller grids for CI / smoke runs.
 * @returns {EraSpec[]}
 */
export function buildEraSpecs(quick = false) {
    const dense = quick ? 6 : 48;
    const sparse = quick ? 4 : 36;
    return [
        {
            id: 'era_3000bc',
            label: '≈3000 BCE',
            jdMin: jdFromGregorianYear(-3100, 1, 1),
            jdMax: jdFromGregorianYear(-2900, 1, 1),
            count: dense,
            kernel: 'de441',
        },
        {
            id: 'era_0_1000',
            label: '0–1000 CE',
            jdMin: jdFromGregorianYear(1, 1, 1),
            jdMax: jdFromGregorianYear(999, 12, 31),
            count: dense,
            kernel: 'de441',
        },
        {
            id: 'era_1000_1850',
            label: '1000–1850 CE',
            jdMin: jdFromGregorianYear(1000, 1, 1),
            jdMax: jdFromGregorianYear(1849, 12, 31),
            count: dense,
            kernel: 'auto',
        },
        {
            id: 'era_1850_2150',
            label: '1850–2150 CE (DE440s window)',
            jdMin: jdFromGregorianYear(1850, 1, 1),
            jdMax: jdFromGregorianYear(2149, 12, 31),
            count: dense,
            kernel: 'de440',
        },
        {
            id: 'era_2150_3000',
            label: '2150–3000 CE',
            jdMin: jdFromGregorianYear(2150, 1, 1),
            jdMax: jdFromGregorianYear(2999, 12, 31),
            count: dense,
            kernel: 'auto',
        },
        {
            id: 'era_deep_sparse',
            label: 'Sparse deep time (±10 ky, DE441)',
            jdMin: DE441_JD_MIN,
            jdMax: DE441_JD_MAX,
            count: sparse,
            kernel: 'de441',
        },
    ];
}

/**
 * @param {EraSpec} era
 * @param {boolean} quick
 */
export function epochsForEra(era, quick = false) {
    const specs = buildEraSpecs(quick);
    const spec = specs.find((s) => s.id === era.id) ?? era;
    let jdMin = spec.jdMin;
    let jdMax = spec.jdMax;
    jdMin = Math.max(jdMin, DE441_JD_MIN);
    jdMax = Math.min(jdMax, DE441_JD_MAX);
    if (jdMax <= jdMin) return [];
    return uniformJdSamples(jdMin, jdMax, spec.count).map((jdUt) => ({
        eraId: spec.id,
        jdUt,
        kernelHint:
            spec.kernel === 'auto'
                ? jdUt >= DE440_JD_MIN && jdUt <= DE440_JD_MAX
                    ? 'de440'
                    : 'de441'
                : spec.kernel,
    }));
}

/**
 * Flatten all sample epochs.
 * @param {boolean} quick
 */
export function allEpochSamples(quick = false) {
    const specs = buildEraSpecs(quick);
    /** @type {{ eraId: string; jdUt: number; kernelHint: string }[]} */
    const out = [];
    for (const era of specs) {
        out.push(...epochsForEra(era, quick));
    }
    return out;
}
