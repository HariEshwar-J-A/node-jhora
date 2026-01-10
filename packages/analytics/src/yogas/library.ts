import { YogaDef } from '../types/rules.js';

export const YOGA_LIBRARY: YogaDef[] = [
    // --- Pancha Mahapurusha Yogas ---
    // Rule: Planet in Kendra (1,4,7,10) AND in Own or Exaltation sign.
    {
        key: 'HAMSA_YOGA',
        name: 'Hamsa Yoga',
        category: 'Raja',
        conditions: [
            {
                type: 'placement',
                planet: 'Jupiter',
                houses: [1, 4, 7, 10],
                signs: [3, 8, 11] // Cancer(3), Sag(8), Pis(11)
            }
        ],
        description_template: 'Jupiter in a Kendra and in Cancer, Sagittarius, or Pisces causes Hamsa Yoga.'
    },
    {
        key: 'MALAVYA_YOGA',
        name: 'Malavya Yoga',
        category: 'Raja',
        conditions: [
            {
                type: 'placement',
                planet: 'Venus',
                houses: [1, 4, 7, 10],
                signs: [1, 6, 11] // Tau(1), Lib(6), Pis(11)
            }
        ],
        description_template: 'Venus in a Kendra and in Taurus, Libra, or Pisces causes Malavya Yoga.'
    },
    {
        key: 'RUCHAKA_YOGA',
        name: 'Ruchaka Yoga',
        category: 'Raja',
        conditions: [
            {
                type: 'placement',
                planet: 'Mars',
                houses: [1, 4, 7, 10],
                signs: [0, 7, 9] // Ari(0), Sco(7), Cap(9)
            }
        ],
        description_template: 'Mars in a Kendra and in Aries, Scorpio, or Capricorn causes Ruchaka Yoga.'
    },
    {
        key: 'BHADRA_YOGA',
        name: 'Bhadra Yoga',
        category: 'Raja',
        conditions: [
            {
                type: 'placement',
                planet: 'Mercury',
                houses: [1, 4, 7, 10],
                signs: [2, 5] // Gem(2), Vir(5)
            }
        ],
        description_template: 'Mercury in a Kendra and in Gemini or Virgo causes Bhadra Yoga.'
    },
    {
        key: 'SASA_YOGA',
        name: 'Sasa Yoga',
        category: 'Raja',
        conditions: [
            {
                type: 'placement',
                planet: 'Saturn',
                houses: [1, 4, 7, 10],
                signs: [9, 10, 6] // Cap(9), Aqu(10), Lib(6)
            }
        ],
        description_template: 'Saturn in a Kendra and in Capricorn, Aquarius, or Libra causes Sasa Yoga.'
    },

    // --- Gaja Kesari Yoga ---
    // Rule: Jupiter in Kendra from Moon.
    {
        key: 'GAJA_KESARI',
        name: 'Gaja Kesari Yoga',
        category: 'Raja',
        conditions: [
            {
                type: 'placement',
                planet: 'Jupiter',
                houses: [1, 4, 7, 10],
                from: 'Moon'
            }
        ],
        description_template: 'Jupiter in a Kendra from the Moon causes Gaja Kesari Yoga.'
    },

    // --- Dharma-Karma Adhipati Yoga ---
    // Rule: Conjunction or mutual aspect between Lords of 9th and 10th.
    {
        key: 'DHARMA_KARMA_ADHIPATI',
        name: 'Dharma-Karma Adhipati Yoga',
        category: 'Raja',
        conditions: [
            {
                type: 'conjunction',
                planets: ['LordOf9', 'LordOf10']
            }
        ],
        description_template: 'The conjunction of the lords of the 9th and 10th houses causes Dharma-Karma Adhipati Yoga.'
    }
];
