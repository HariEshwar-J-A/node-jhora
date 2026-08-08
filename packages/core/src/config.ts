/**
 * config.ts — Every calculation choice this engine makes, in one place.
 *
 * A Jyotish chart is not the output of one algorithm; it is the output of a
 * stack of independent decisions, and the authority for each is different:
 *
 *   1. **Astronomy** — where the bodies physically are. Settled by JPL DE440.
 *      Not a matter of opinion, and not configurable beyond `positionMode`
 *      (whether to report where a body *is* or where it is *seen*).
 *
 *   2. **Sidereal zero point** — the ayanamsa. Genuinely undecidable: BPHS
 *      assumes a sidereal zodiac but fixes no number, and the classical anchors
 *      (Chitra at 180°, Revati at 359°50′) are mutually inconsistent. So this is
 *      a *named choice*, never a fitted constant.
 *
 *   3. **Jyotish rules** — vargas, dashas, houses. Settled by BPHS, where the
 *      text is unambiguous. Where implementations differ from BPHS (JHora's D10
 *      being the known case), BPHS wins by default and the variant is offered.
 *
 * Defaults reflect that policy: Drik Siddhanta astronomy, True Chitrapaksha
 * zero point, and classical Parashara rules.
 *
 * Every option here can be set three ways, in increasing precedence:
 *   - the library default, below
 *   - an instance default, via the `NodeJHora` constructor
 *   - a per-call override, on the individual function
 */

import { AYANAMSA, DEFAULT_POSITION_MODE, DEFAULT_NODE_TYPE, type PositionMode } from './engine/ephemeris.js';
import { DEFAULT_DASAMSA_SCHEME, DEFAULT_HORA_SCHEME,
         type DasamsaScheme, type HoraScheme }                                  from './vedic/vargas.js';

/** House systems the engine can produce. */
export type HouseSystem = 'WholeSign' | 'Equal' | 'Placidus' | 'Porphyry';

/** Mean or true (osculating) lunar node for Rahu/Ketu. */
export type NodeType = 'mean' | 'true';

export interface JyotishConfig {
    // ── Layer 1: astronomy ──────────────────────────────────────────────────

    /**
     * Report geometric positions (where a body is) or apparent ones (where it is
     * seen, after light-time, deflection and aberration).
     *
     * Jyotish convention — and JHora — is `'geometric'`. `'apparent'` matches JPL
     * Horizons and professional astronomy. The two differ by up to ~44″.
     */
    positionMode: PositionMode;

    /**
     * Correct for the observer's position on Earth's surface rather than its
     * centre. Matters almost only for the Moon, where parallax reaches ~1°.
     */
    topocentric: boolean;

    /** Observer height above the ellipsoid, metres. Only used when topocentric. */
    altitudeMetres: number;

    // ── Layer 2: sidereal zero point ────────────────────────────────────────

    /**
     * Swiss Ephemeris `SE_SIDM_*` mode. Default 27 = True Chitrapaksha, which is
     * derived from Spica's computed position and so needs no fitted constant.
     */
    ayanamsaMode: number;

    /**
     * Constant added to the ayanamsa, in degrees. For practitioners who work
     * with a personal offset from a standard model; leave at 0 otherwise.
     */
    ayanamsaOffset: number;

    // ── Layer 3: Jyotish rules ──────────────────────────────────────────────

    /** Mean or true lunar node. JHora uses `'true'`; many practitioners use `'mean'`. */
    nodeType: NodeType;

    /** House system. Whole Sign is the Parashari standard. */
    houseSystem: HouseSystem;

    /**
     * D10 rule for even signs. `'parashara'` follows BPHS (ten parts from the
     * ninth sign); `'jhora_5_8'` reproduces JHora's variant.
     */
    dasamsaScheme: DasamsaScheme;

    /**
     * D2 rule. `'parashara'` follows BPHS — a Hora position falls only in Leo
     * (Sun) or Cancer (Moon). `'parivritti'` is the twelve-sign variant.
     */
    horaScheme: HoraScheme;

    /**
     * Local sunrise as a decimal hour, used to place the Vedic weekday (vara),
     * which begins at sunrise rather than midnight. Supply the real sunrise for
     * the birth place; the default is a nominal 6 a.m.
     */
    sunriseHour: number;

    /**
     * Length of a Vimshottari dasha year in days. The tropical year is the
     * standard; some traditions use 360 (savana) or 365.25 (Julian).
     */
    dashaYearDays: number;
}

/** Tropical year, the standard Vimshottari dasha year. */
export const TROPICAL_YEAR_DAYS = 365.242189623;

/**
 * Library defaults: Drik Siddhanta astronomy, True Chitrapaksha zero point,
 * classical Parashara rules.
 */
export const DEFAULT_CONFIG: JyotishConfig = {
    positionMode:   DEFAULT_POSITION_MODE,
    topocentric:    false,
    altitudeMetres: 0,

    ayanamsaMode:   AYANAMSA.TRUE_CITRA,
    ayanamsaOffset: 0,

    nodeType:       DEFAULT_NODE_TYPE,
    houseSystem:    'WholeSign',
    dasamsaScheme:  DEFAULT_DASAMSA_SCHEME,
    horaScheme:     DEFAULT_HORA_SCHEME,
    sunriseHour:    6.0,
    dashaYearDays:  TROPICAL_YEAR_DAYS,
};

/**
 * Preset reproducing Jagannatha Hora's own conventions.
 *
 * Verified against a real JHora export (1998-12-06, Chennai): every D1 body to
 * 0.01″, ascendant to 0.00″, D9 to 0.1″, D10 to 0.5″.
 *
 * Note this deliberately departs from the library default on `dasamsaScheme`,
 * because JHora's D10 variant is not the BPHS rule.
 */
export const JHORA_PRESET: Partial<JyotishConfig> = {
    ayanamsaMode:  AYANAMSA.TRUE_CITRA,
    positionMode:  'geometric',
    nodeType:      'true',
    dasamsaScheme: 'jhora_5_8',
    houseSystem:   'WholeSign',
};

/**
 * Merge a partial override onto a base configuration.
 *
 * `undefined` fields fall through to the base, so callers can pass sparse
 * objects — including ones built from optional API fields — without having to
 * strip missing keys first.
 */
export function resolveConfig(
    override: Partial<JyotishConfig> = {},
    base: JyotishConfig = DEFAULT_CONFIG,
): JyotishConfig {
    const out = { ...base };
    for (const [k, v] of Object.entries(override)) {
        if (v !== undefined) (out as Record<string, unknown>)[k] = v;
    }
    return out;
}
