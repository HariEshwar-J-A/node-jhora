export type MatchSystem = 'AshtaKuta' | 'DashaKuta';

export interface KutaScore {
    name: string;
    score: number;
    maxScore: number;
    description: string;
    isCompatible: boolean;
}

export interface DoshaResult {
    boyHasDosha: boolean;
    girlHasDosha: boolean;
    matchStatus: 'Cancel' | 'Present' | 'None';
    exceptions?: string[];
}

export interface MatchResult {
    system: MatchSystem;
    totalScore: number;
    maxScore: number;
    isCompatible: boolean;
    isRajjuMismatch?: boolean; // Critical Deal Breaker (South)
    isVedhaMismatch?: boolean; // Critical Mutual Obstruction
    matches: KutaScore[];
    dosha?: DoshaResult;
}

// Enums / Types for Logic
export enum Gana {
    Deva = 0,
    Manushya = 1,
    Rakshasa = 2
}

export enum YoniAnimal {
    Horse = 0,
    Elephant = 1,
    Sheep = 2,
    Snake = 3,
    Dog = 4,
    Cat = 5,
    Rat = 6,
    Cow = 7,
    Buffalo = 8,
    Tiger = 9,
    Hare = 10,
    Monkey = 11,
    Lion = 12,
    Mongoose = 13
}

export enum Nadi {
    Adi = 0, // Vata
    Madhya = 1, // Pitta
    Antya = 2 // Kapha
}

export enum Rajju {
    Shiro = 0, // Head
    Kanta = 1, // Neck
    Nabhi = 2, // Navel
    Kati = 3, // Thigh/Waist
    Pada = 4 // Foot
}

export enum Varna {
    Brahmin = 0,
    Kshatriya = 1,
    Vaishya = 2,
    Shudra = 3
}

export enum Vashya {
    Chatuspada = 0, // Quadruped
    Manava = 1, // Human
    Jalachara = 2, // Water
    Vanachara = 3, // Wild (Lion)
    Keeta = 4 // Insect
}
