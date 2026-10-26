/**
 * Allow-list of golden feature paths.
 *
 * A path that matches no rule fails validation. Longitude-like paths compare
 * in arcseconds, instants and durations in seconds, and names, flags, and
 * printed text compare exactly.
 */

export type ToleranceType = 'arcsec' | 'seconds' | 'exact';

export type ValueKind = 'number' | 'integer' | 'string' | 'boolean' | 'number-or-string';

export interface FeaturePathRule {
    id: string;
    /** ECMAScript source, anchored by `matchFeaturePath`. */
    pattern: string;
    tolerance: ToleranceType;
    valueKind: ValueKind;
}

/** D1 to D60, no leading zero. */
const VARGA = 'd(?:[1-9]|[1-5]\\d|60)';
/** Dasa systems with goldens. Add a name here when its engine lands. */
const DASA = 'vimshottari';
/** Maha dasa `[n]`, then up to five sub-levels (antar to deha) as `[n][m]...`. */
const DASA_PERIOD = `dasa\\.(?:${DASA})(?:\\[\\d+\\]){1,6}`;
const BODY = 'Sun|Moon|Mars|Mercury|Jupiter|Venus|Saturn|Rahu|Ketu';

function rule(
    id: string,
    pattern: string,
    tolerance: ToleranceType,
    valueKind: ValueKind,
): FeaturePathRule {
    return { id, pattern, tolerance, valueKind };
}

export const FEATURE_PATH_RULES: readonly FeaturePathRule[] = [
    rule('varga-planet-angle', `${VARGA}\\.planets\\.(?:${BODY})\\.(?:lon|lat)`, 'arcsec', 'number'),
    rule('varga-planet-sign', `${VARGA}\\.planets\\.(?:${BODY})\\.sign`, 'exact', 'integer'),
    rule('varga-planet-printed', `${VARGA}\\.planets\\.(?:${BODY})\\.printed`, 'exact', 'string'),
    rule('varga-planet-retrograde', `${VARGA}\\.planets\\.(?:${BODY})\\.retrograde`, 'exact', 'boolean'),
    rule('varga-asc-angle', `${VARGA}\\.ascendant\\.(?:lon|lat)`, 'arcsec', 'number'),
    rule('varga-asc-sign', `${VARGA}\\.ascendant\\.sign`, 'exact', 'integer'),
    rule('varga-asc-printed', `${VARGA}\\.ascendant\\.printed`, 'exact', 'string'),
    rule('ayanamsa-value', 'ayanamsa\\.value', 'arcsec', 'number'),
    rule('ayanamsa-printed', 'ayanamsa\\.printed', 'exact', 'string'),
    rule('ayanamsa-mode', 'ayanamsa\\.mode', 'exact', 'integer'),
    rule('sidereal-hours', 'siderealTime\\.hours', 'seconds', 'number'),
    rule('sidereal-printed', 'siderealTime\\.printed', 'exact', 'string'),
    rule('panchanga-name', 'panchanga\\.(?:tithi|nakshatra|yoga|karana|vara)\\.name', 'exact', 'string'),
    rule('panchanga-index', 'panchanga\\.(?:tithi|nakshatra|vara)\\.index', 'exact', 'integer'),
    rule('panchanga-pada', 'panchanga\\.nakshatra\\.pada', 'exact', 'integer'),
    rule('panchanga-percent', 'panchanga\\.(?:tithi|nakshatra|yoga|karana)\\.percentLeft', 'exact', 'number'),
    rule('panchanga-tolerance', 'meta\\.panchanga\\.tolerancePercent', 'exact', 'number'),
    rule('dasa-start-lord', `dasa\\.(?:${DASA})\\.startLord`, 'exact', 'string'),
    rule('dasa-lord', `${DASA_PERIOD}\\.lord`, 'exact', 'string'),
    rule('dasa-bound', `${DASA_PERIOD}\\.(?:start|end)`, 'seconds', 'number-or-string'),
    rule('d10-scheme', 'd10\\.scheme', 'exact', 'string'),
    rule('d10-label', 'd10\\.label', 'exact', 'string'),
    rule('d10-even-sign', 'd10\\.evenSignBodies\\[\\d+\\]', 'exact', 'string'),
    rule('horizons-angle', `horizons\\.planets\\.(?:${BODY})\\.(?:lon|lat)`, 'arcsec', 'number'),
    rule('time-jd', 'time\\.jd', 'exact', 'number'),
    rule('meta-clock', 'meta\\.birth\\.(?:local|utc)\\.(?:year|month|day|hour|minute|second)', 'exact', 'integer'),
    rule('meta-offset', 'meta\\.birth\\.utcOffsetHours', 'exact', 'number'),
    rule('meta-epoch-label', 'meta\\.epoch\\.label', 'exact', 'string'),
    rule('meta-epoch-bodies', 'meta\\.epoch\\.bodies\\[\\d+\\]', 'exact', 'string'),
    rule('meta-deltat-year', 'meta\\.contract\\.lastObservedDeltaTYear', 'exact', 'integer'),
    rule('meta-tolerance', 'meta\\.contract\\.(?:tolerance|futureTolerance)\\.(?:longitude|latitude)', 'exact', 'number'),
];

interface CompiledRule extends FeaturePathRule {
    re: RegExp;
}

const compiled: CompiledRule[] = FEATURE_PATH_RULES.map((rule) => ({
    ...rule,
    re: new RegExp(`^(?:${rule.pattern})$`),
}));

/** The single rule that matches `path`, or `undefined` when none do. */
export function matchFeaturePath(path: string): FeaturePathRule | undefined {
    const hits = compiled.filter((rule) => rule.re.test(path));
    if (hits.length > 1) {
        throw new Error(
            `Feature path ${JSON.stringify(path)} matched ${hits.map((hit) => hit.id).join(', ')}`,
        );
    }
    return hits[0];
}

/** Anchored pattern for JSON Schema `patternProperties`. */
export function anchoredPattern(rule: FeaturePathRule): string {
    return `^(?:${rule.pattern})$`;
}
