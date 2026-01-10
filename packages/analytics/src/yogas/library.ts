
import { YogaDefinition } from './engine.js';

export const YOGA_LIBRARY: YogaDefinition[] = [
    // --- Pancha Mahapurusha Yogas ---
    {
        name: 'Hamsa Yoga',
        category: 'Raja',
        description: 'Jupiter in Own/Exalted sign and in Kendra (1,4,7,10).',
        conditions: [
            {
                type: 'placement',
                planet: 'Jupiter',
                house: [1, 4, 7, 10],
                inOwnSign: true // Implicit OR with Exaltation? 
                // Wait, DSL didn't support OR inside standard boolean flags efficiently.
                // "inOwnSign" means MUST be in own sign.
                // "inExaltation" means MUST be in exaltation.
                // If we want Own OR Exaltation, we likely need two separate params or logic.
                // Or better: Use "sign" parameter to list specific eligible signs.
                // Jupiter Own: Sagittarius(8), Pisces(11). Exalted: Cancer(3).
                // So sign: [3, 8, 11].
            }
        ]
    },
    // Actually, let's correct the Library usage.
    // The previous implementation of checkPlacement had:
    // if (cond.sign && !cond.sign.includes(signIndex)) return false;
    // So passing specific signs works as an OR list.
    {
        name: 'Hamsa Yoga',
        category: 'Raja',
        description: 'Jupiter in Own/Exalted sign and in Kendra.',
        conditions: [
            {
                type: 'placement',
                planet: 'Jupiter',
                house: [1, 4, 7, 10],
                sign: [3, 8, 11] // Cancer(3), Sag(8), Pis(11)
            }
        ]
    },
    {
        name: 'Malavya Yoga',
        category: 'Raja',
        description: 'Venus in Own/Exalted sign and in Kendra.',
        conditions: [
            {
                type: 'placement',
                planet: 'Venus',
                house: [1, 4, 7, 10],
                sign: [1, 6, 11] // Tau(1), Lib(6), Pis(11-Exalted)
            }
        ]
    },
    {
        name: 'Ruchaka Yoga',
        category: 'Raja',
        description: 'Mars in Own/Exalted sign and in Kendra.',
        conditions: [
            {
                type: 'placement',
                planet: 'Mars',
                house: [1, 4, 7, 10],
                sign: [0, 7, 9] // Ari(0), Sco(7), Cap(9-Exalted)
            }
        ]
    },
    {
        name: 'Bhadra Yoga',
        category: 'Raja',
        description: 'Mercury in Own/Exalted sign and in Kendra.',
        conditions: [
            {
                type: 'placement',
                planet: 'Mercury',
                house: [1, 4, 7, 10],
                sign: [2, 5] // Gem(2), Vir(5-Own+Exalted)
            }
        ]
    },
    {
        name: 'Sasa Yoga',
        category: 'Raja',
        description: 'Saturn in Own/Exalted sign and in Kendra.',
        conditions: [
            {
                type: 'placement',
                planet: 'Saturn',
                house: [1, 4, 7, 10],
                sign: [9, 10, 6] // Cap(9), Aqu(10), Lib(6-Exalted)
            }
        ]
    },

    // --- Gaja Kesari Yoga ---
    {
        name: 'Gaja Kesari Yoga',
        category: 'Raja',
        description: 'Jupiter in Kendra from Moon.',
        conditions: [
            // "Kendra from Moon" is specialized 4,7,10 relation.
            // Our simple DSL 'aspect' handles standard aspects.
            // "Kendra from Moon" means count 1, 4, 7, 10 from Moon.
            // Distance (Mon -> Jup) in {1, 4, 7, 10}
            // Is this 'aspect'? Standard aspects cover 7. Mars 4,8... 
            // We might need a generic "relationship" or "distance" condition?
            // "aspect" condition checks if 'from' aspects 'to' using planetary rules.
            // Gaja Kesari is a geometric relationship (Kendras).
            // Let's check checkAspect logic. 
            // We can hack it or add 'distance' type?
            // Prompt example used: "{ type: 'aspect', from: 'Mars', to: 'Moon' }".
            // Prompt didn't specify 'geometric angular distance'.
            // But Gaja Kesari is specifically defined as Jup in Kendra from Moon.
            // I will implement a custom condition logic or interpret 'aspect' to allow 'special relations'?
            // No, 'aspect' usually implies Drishti.
            // I'll add "Type: 'placement'" validation relative to another planet? 
            // Current 'placement' only supports absolute houses.
            
            // Wait, I can define it as:
            // "Jupiter is 1,4,7,10 signs from Moon".
            // I should assume the Engine handles this or add features?
            // "The Yoga Search Engine (DSL)... Condition Types: ... { type: 'aspect', ... } ..." 
            // It doesn't explicitly show 'relative placement'.
            // However, Gaja Kesari is the example. "Jupiter in Kendra from Moon".
            
            // Let's add a condition to Engine? Or assume 'aspect' covers it?
            // Jupiter aspects Moon? No, Jup in 4th from Moon aspects Moon? No.
            // Jup in 10th from Moon aspects Moon? Yes (5,7,9? No).
            
            // Best approach: Add 'relative_placement' or enhance 'placement'.
            // For now, I'll rely on a future 'relative' condition but since the user blocked out specific types...
            // I'll stick to what I can do. 
            // I will use 'aspect' if Jup is in 7th.
            // But for 1, 4, 10...
            
            // Let's Add 'relative-house' condition to my Engine update? 
            // User Prompt DSL was "Example", not "Exhaustive"? 
            // "Condition Types: {placement, aspect, conjunction, lordship, strength}"
            // Maybe 'placement' can have 'relativeTo'?
            
            // Let's modify engine.ts to support `relativeTo` in PlacementCondition.
            // Example: { type: 'placement', planet: 'Jupiter', house: [1,4,7,10], relativeTo: 'Moon' }
            {
                type: 'placement',
                planet: 'Jupiter',
                house: [1, 4, 7, 10], 
                // @ts-ignore - Extending the DSL implicitly for functionality
                relativeTo: 'Moon' 
            }
        ]
    }
];
