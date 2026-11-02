import type { AYANAMSA_IDS, HOUSE_SYSTEM_IDS } from '@node-jhora/core';

const AYANAMSA_LABELS: Record<(typeof AYANAMSA_IDS)[number], string> = {
    true_citra: 'True Chitra (Lahiri-type)',
    true_pushya: 'True Pushya',
    true_mula: 'True Mula',
    fagan_bradley: 'Fagan–Bradley',
    lahiri: 'Lahiri (mean)',
    lahiri_icrc: 'Lahiri ICRC',
    raman: 'Raman',
    kp: 'Krishnamurti (KP)',
    j2000: 'J2000',
};

const HOUSE_LABELS: Partial<Record<(typeof HOUSE_SYSTEM_IDS)[number], string>> = {
    whole_sign: 'Whole sign',
    equal: 'Equal (Asc)',
    placidus: 'Placidus',
    porphyry: 'Porphyry',
    koch: 'Koch',
    regiomontanus: 'Regiomontanus',
    campanus: 'Campanus',
    alcabitius: 'Alcabitius',
    topocentric: 'Topocentric',
    morinus: 'Morinus',
    meridian: 'Meridian',
    krusinski: 'Krusinski',
    horizontal: 'Horizontal',
    vehlow: 'Vehlow',
    equal_mc: 'Equal (MC)',
    equal_aries: 'Equal (Aries)',
    sripati: 'Sripati',
    carter: 'Carter',
    pullen_sd: 'Pullen SD',
    pullen_sr: 'Pullen SR',
    apc: 'APC',
    gauquelin: 'Gauquelin',
    sunshine: 'Sunshine',
    sunshine_treindl: 'Sunshine (Treindl)',
    nine_pada_equal: 'Nine pada (equal)',
    surya_siddhanta_houses: 'Surya Siddhanta',
};

export function labelAyanamsa(id: (typeof AYANAMSA_IDS)[number]): string {
    return AYANAMSA_LABELS[id] ?? id.replace(/_/g, ' ');
}

export function labelHouseSystem(id: (typeof HOUSE_SYSTEM_IDS)[number]): string {
    return HOUSE_LABELS[id] ?? id.replace(/_/g, ' ');
}
