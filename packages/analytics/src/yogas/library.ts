
import { YogaDefinition } from '../types/rules.js';

export const YOGA_LIBRARY: YogaDefinition[] = [
    // --- Pancha Mahapurusha Yogas ---
    {
        id: 'HAMSA_YOGA',
        name: 'Hamsa Yoga',
        group: 'Raja',
        conditions: [
            {
                type: 'placement',
                planet: 'Jupiter',
                house: [1, 4, 7, 10],
                sign: [3, 8, 11] // Cancer(3), Sag(8), Pis(11)
            }
        ],
        interpretation_key: 'hamsa_yoga_desc'
    },
    {
        id: 'MALAVYA_YOGA',
        name: 'Malavya Yoga',
        group: 'Raja',
        conditions: [
            {
                type: 'placement',
                planet: 'Venus',
                house: [1, 4, 7, 10],
                sign: [1, 6, 11] // Tau(1), Lib(6), Pis(11)
            }
        ],
        interpretation_key: 'malavya_yoga_desc'
    },
    {
        id: 'RUCHAKA_YOGA',
        name: 'Ruchaka Yoga',
        group: 'Raja',
        conditions: [
            {
                type: 'placement',
                planet: 'Mars',
                house: [1, 4, 7, 10],
                sign: [0, 7, 9] // Ari(0), Sco(7), Cap(9)
            }
        ],
        interpretation_key: 'ruchaka_yoga_desc'
    },
    {
        id: 'BHADRA_YOGA',
        name: 'Bhadra Yoga',
        group: 'Raja',
        conditions: [
            {
                type: 'placement',
                planet: 'Mercury',
                house: [1, 4, 7, 10],
                sign: [2, 5] // Gem(2), Vir(5)
            }
        ],
        interpretation_key: 'bhadra_yoga_desc'
    },
    {
        id: 'SASA_YOGA',
        name: 'Sasa Yoga',
        group: 'Raja',
        conditions: [
            {
                type: 'placement',
                planet: 'Saturn',
                house: [1, 4, 7, 10],
                sign: [9, 10, 6] // Cap(9), Aqu(10), Lib(6)
            }
        ],
        interpretation_key: 'sasa_yoga_desc'
    },

    // --- Gaja Kesari Yoga ---
    {
        id: 'GAJA_KESARI',
        name: 'Gaja Kesari Yoga',
        group: 'Raja',
        conditions: [
            {
                type: 'placement',
                planet: 'Jupiter',
                house: [1, 4, 7, 10], 
                relativeTo: 'Moon' 
            }
        ],
        interpretation_key: 'gaja_kesari_desc'
    }
];
