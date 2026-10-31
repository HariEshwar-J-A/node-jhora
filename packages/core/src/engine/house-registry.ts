/**
 * House system identifiers (settings/API) and Swiss Ephemeris letter codes.
 */

import type { HouseLetter } from './house-systems.js';

/** Settings / API snake_case ids for every supported house system. */
export const HOUSE_SYSTEM_IDS = [
    'whole_sign',
    'equal',
    'placidus',
    'porphyry',
    'koch',
    'regiomontanus',
    'campanus',
    'alcabitius',
    'topocentric',
    'morinus',
    'meridian',
    'krusinski',
    'horizontal',
    'vehlow',
    'equal_mc',
    'equal_aries',
    'sripati',
    'carter',
    'pullen_sd',
    'pullen_sr',
    'apc',
    'gauquelin',
    'sunshine',
    'sunshine_treindl',
    /** JHora: 360° / 9 = 40° steps from the ascendant sign start. */
    'nine_pada_equal',
    /** JHora: Surya Siddhanta obliquity + equal houses (see ADR 0017). */
    'surya_siddhanta_houses',
] as const;

export type HouseSystemId = (typeof HOUSE_SYSTEM_IDS)[number];

export const HOUSE_ANCHOR_IDS = ['ascendant', 'moon', 'sun', 'aries'] as const;
export type HouseAnchorId = (typeof HOUSE_ANCHOR_IDS)[number];

const ID_TO_LETTER: Record<HouseSystemId, HouseLetter> = {
    whole_sign: 'W',
    equal: 'E',
    placidus: 'P',
    porphyry: 'O',
    koch: 'K',
    regiomontanus: 'R',
    campanus: 'C',
    alcabitius: 'B',
    topocentric: 'T',
    morinus: 'M',
    meridian: 'X',
    krusinski: 'U',
    horizontal: 'H',
    vehlow: 'V',
    equal_mc: 'D',
    equal_aries: 'N',
    sripati: 'S',
    carter: 'F',
    pullen_sd: 'L',
    pullen_sr: 'Q',
    apc: 'Y',
    gauquelin: 'G',
    sunshine: 'I',
    sunshine_treindl: 'i',
    nine_pada_equal: 'E',
    surya_siddhanta_houses: 'E',
};

/** Legacy PascalCase names used by {@link JyotishConfig}. */
export type HouseSystemLegacy =
    | 'WholeSign'
    | 'Equal'
    | 'Placidus'
    | 'Porphyry'
    | 'Koch'
    | 'Regiomontanus'
    | 'Campanus'
    | 'Alcabitius'
    | 'Topocentric'
    | 'Morinus'
    | 'Meridian'
    | 'Krusinski'
    | 'Horizontal'
    | 'Vehlow'
    | 'EqualMc'
    | 'EqualAries'
    | 'Sripati'
    | 'Carter'
    | 'PullenSd'
    | 'PullenSr'
    | 'Apc'
    | 'Gauquelin'
    | 'Sunshine'
    | 'SunshineTreindl'
    | 'NinePadaEqual'
    | 'SuryaSiddhantaHouses';

const LEGACY_TO_ID: Record<HouseSystemLegacy, HouseSystemId> = {
    WholeSign: 'whole_sign',
    Equal: 'equal',
    Placidus: 'placidus',
    Porphyry: 'porphyry',
    Koch: 'koch',
    Regiomontanus: 'regiomontanus',
    Campanus: 'campanus',
    Alcabitius: 'alcabitius',
    Topocentric: 'topocentric',
    Morinus: 'morinus',
    Meridian: 'meridian',
    Krusinski: 'krusinski',
    Horizontal: 'horizontal',
    Vehlow: 'vehlow',
    EqualMc: 'equal_mc',
    EqualAries: 'equal_aries',
    Sripati: 'sripati',
    Carter: 'carter',
    PullenSd: 'pullen_sd',
    PullenSr: 'pullen_sr',
    Apc: 'apc',
    Gauquelin: 'gauquelin',
    Sunshine: 'sunshine',
    SunshineTreindl: 'sunshine_treindl',
    NinePadaEqual: 'nine_pada_equal',
    SuryaSiddhantaHouses: 'surya_siddhanta_houses',
};

const ID_TO_LEGACY: Record<HouseSystemId, HouseSystemLegacy> = Object.fromEntries(
    Object.entries(LEGACY_TO_ID).map(([legacy, id]) => [id, legacy as HouseSystemLegacy]),
) as Record<HouseSystemId, HouseSystemLegacy>;

export function houseLetterForId(id: HouseSystemId): HouseLetter {
    return ID_TO_LETTER[id];
}

export function houseSystemIdFromLegacy(legacy: HouseSystemLegacy): HouseSystemId {
    return LEGACY_TO_ID[legacy];
}

export function houseSystemLegacyFromId(id: HouseSystemId): HouseSystemLegacy {
    return ID_TO_LEGACY[id];
}

/** All SE letter codes the engine accepts on {@link EphemerisEngine.getHouses}. */
export const HOUSE_LETTERS: readonly HouseLetter[] = [
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
    'I',
    'i',
    'K',
    'L',
    'M',
    'N',
    'O',
    'P',
    'Q',
    'R',
    'S',
    'T',
    'U',
    'V',
    'W',
    'X',
    'Y',
];

export function isHouseLetter(value: string): value is HouseLetter {
    return (HOUSE_LETTERS as readonly string[]).includes(value);
}

export function isHouseSystemId(value: string): value is HouseSystemId {
    return (HOUSE_SYSTEM_IDS as readonly string[]).includes(value);
}
