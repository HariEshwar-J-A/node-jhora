/**
 * Named calculation presets.
 *
 * `jhora-default@8.0` records the factory calculation defaults observed for
 * Jagannatha Hora 8.0: true Chitrapaksha, geometric places, the mean node,
 * equal houses with the cusp in the middle, disc-centre sunrise without
 * refraction, and a mean tropical year of 365.24219 days. Variant indexes
 * under `vargaVariants` are placeholders and are not applied.
 *
 * That bundle is not `JHORA_PRESET`. The verified chart export uses the true
 * node and the even-sign dasamsa counted from the 5th house.
 */

import { TROPICAL_YEAR_DAYS } from '../config.js';
import {
    type CalculationSettings,
    CalculationSettingsSchema,
} from './schema.js';

const NODE_JHORA_RAW = {
    schemaVersion: 1 as const,
    ayanamsa: 'true_citra' as const,
    ayanamsaOffsetDeg: 0,
    nodeType: 'true' as const,
    houseSystem: 'whole_sign' as const,
    cuspsInMiddle: false,
    positionMode: 'geometric' as const,
    topocentric: false,
    altitudeMetres: 0,
    sunrise: { limb: 'disc_centre' as const, refraction: false, nominalHour: 6 },
    dasaYear: { kind: 'mean_tropical' as const, days: TROPICAL_YEAR_DAYS },
    dasamsaScheme: 'parashara' as const,
    horaScheme: 'parashara' as const,
    vargaVariants: { d2: 'parashara', d10: 'parashara' },
};

function define(patch: Partial<CalculationSettings> = {}): CalculationSettings {
    return CalculationSettingsSchema.parse({
        ...NODE_JHORA_RAW,
        ...patch,
        sunrise: { ...NODE_JHORA_RAW.sunrise, ...patch.sunrise },
        dasaYear: { ...NODE_JHORA_RAW.dasaYear, ...patch.dasaYear },
        vargaVariants: { ...NODE_JHORA_RAW.vargaVariants, ...patch.vargaVariants },
    });
}

/** Divisions whose factory variant index is recorded as 0, plus the three exceptions. */
function jhoraVargaVariants(): Record<string, string> {
    const variants: Record<string, string> = { d2: 'index:6' };
    for (const division of [3, 4, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60, 108, 150]) {
        const later = division === 24 || division === 108 || division === 150;
        variants[`d${division}`] = later ? 'index:1' : 'index:0';
    }
    return variants;
}

export const PRESET_IDS = [
    'jhora-default@8.0',
    'node-jhora-default',
    'kp',
    'raman',
    'lahiri-mean',
] as const;

export type PresetId = (typeof PRESET_IDS)[number];

export const PRESETS: Record<PresetId, CalculationSettings> = {
    // Each value below is checked against our own clean-room analysis,
    // JHORA_ANALYSIS.md, kept outside this repo (section numbers in brackets):
    //   ayanamsa true_citra        [§6.3 UserSelectedAyanamsa=17; §7.2 enum 17
    //                               "True Lahiri / Chitrapaksha", Spica at 180°]
    //   ayanamsaOffsetDeg 0        [§6.3 DeltaFromUserSelectedAyanamsa]
    //   positionMode geometric     [§6.3 TruePositions=1; §7.1 SEFLG_TRUEPOS]
    //   topocentric false          [§6.3 TopocentricPositions=0]
    //   nodeType mean              [§6.3 TrueNodes=0; §7.1 SE body 10]
    //   equal, cuspsInMiddle       [§6.3 HouseTypeWanted=1, HouseCuspsInMiddle=1;
    //                               §7.10, inferred from list order]
    //   sunrise disc centre,       [§6.3 SunriseDefinition=0, ApparentRefraction=0;
    //     no refraction             §7.7]
    //   dasaYear 365.24219 d       [§6.3 YearLength; §7.4 mean tropical year]
    //   vargaVariants              [§6.3 HoraPreference=6, D24/D108/D150=1, rest 0]
    // Known gap: HoraPreference=6 is not the Leo/Cancer rule (§7.9 infers the
    // Kashinatha hora). `horaScheme` can only name a rule the engine computes,
    // so it stays 'parashara' and `vargaVariants.d2` records the real index.
    // D10Preference=0 is the first, traditional variant (§7.9), so
    // `dasamsaScheme` stays 'parashara'.
    'jhora-default@8.0': define({
        nodeType: 'mean',
        houseSystem: 'equal',
        cuspsInMiddle: true,
        dasaYear: { kind: 'mean_tropical', days: 365.24219 },
        vargaVariants: jhoraVargaVariants(),
    }),
    'node-jhora-default': define(),
    kp: define({
        ayanamsa: 'kp',
        houseSystem: 'placidus',
    }),
    raman: define({ ayanamsa: 'raman' }),
    'lahiri-mean': define({
        ayanamsa: 'lahiri',
        nodeType: 'mean',
    }),
};

export function isPresetId(value: string): value is PresetId {
    return Object.prototype.hasOwnProperty.call(PRESETS, value);
}

export function getPreset(id: PresetId): CalculationSettings {
    const preset = PRESETS[id];
    if (!preset) throw new Error(`Unknown calculation preset: ${id}`);
    return structuredClone(preset);
}
