import { Gana, YoniAnimal, Nadi, Varna, Vashya } from '../types.js';

// Table mapping Nakshatra 0-26 to Properties

// Gana Table
export const GANA_TABLE: Gana[] = [
    Gana.Deva, Gana.Manushya, Gana.Rakshasa, // 1-3
    Gana.Manushya, Gana.Deva, Gana.Manushya, // 4-6
    Gana.Deva, Gana.Deva, Gana.Rakshasa,     // 7-9
    Gana.Rakshasa, Gana.Manushya, Gana.Manushya, // 10-12
    Gana.Deva, Gana.Rakshasa, Gana.Deva,     // 13-15
    Gana.Deva, Gana.Deva, Gana.Rakshasa,     // 16-18
    Gana.Rakshasa, Gana.Deva, Gana.Manushya, // 19-21
    Gana.Deva, Gana.Rakshasa, Gana.Rakshasa, // 22-24
    Gana.Manushya, Gana.Manushya, Gana.Deva  // 25-27
];

// Yoni Table (Nak -> YoniAnimal)
export const YONI_TABLE: YoniAnimal[] = [
    YoniAnimal.Horse, YoniAnimal.Elephant, YoniAnimal.Sheep, YoniAnimal.Snake, // 1-4
    YoniAnimal.Snake, YoniAnimal.Dog, YoniAnimal.Cat, YoniAnimal.Sheep, // 5-8
    YoniAnimal.Cat, YoniAnimal.Rat, YoniAnimal.Rat, YoniAnimal.Cow, // 9-12
    YoniAnimal.Buffalo, YoniAnimal.Tiger, YoniAnimal.Buffalo, YoniAnimal.Tiger, // 13-16
    YoniAnimal.Hare, YoniAnimal.Hare, YoniAnimal.Monkey, YoniAnimal.Monkey, // 17-20
    YoniAnimal.Lion, YoniAnimal.Lion, YoniAnimal.Mongoose, YoniAnimal.Horse, // 21-24
    YoniAnimal.Lion, YoniAnimal.Cow, YoniAnimal.Elephant // 25-27
];



export const VASHYA_PAIRS: Record<number, number[]> = {
    1: [5, 8], // Aries -> Leo, Scorpio
    2: [4, 7], // Taurus -> Cancer, Libra
    3: [6],    // Gemini -> Virgo
    4: [8, 9], // Cancer -> Scorpio, Sagittarius
    5: [7],    // Leo -> Libra
    6: [3, 12], // Virgo -> Gemini, Pisces
    7: [10],   // Libra -> Capricorn (Some sources say Virgo, Capricorn, etc.)
               // Using Standard: Libra -> Capricorn, Virgo?
               // Let's stick to reciprocal logic where possible or standard list.
               // Standard List (B.V. Raman / North):
               // Aries: Leo, Scorp
               // Tau: Can, Lib
               // Gem: Vir
               // Can: Sco, Sag
               // Leo: Lib
               // Vir: Gem, Pis
               // Lib: Cap, Vir? 
               // Sco: Can
               // Sag: Pis
               // Cap: Ari, Aqu
               // Aqu: Ari
               // Pis: Cap
               // Note: This table varies wildly. Using B.V. Raman / Standard North:
               // 1: 5, 8
               // 2: 4, 7
               // 3: 6
               // 4: 8, 9
               // 5: 7
               // 6: 3, 12
               // 7: 10
               // 8: 4
               // 9: 12
               // 10: 1, 11
               // 11: 1
               // 12: 10
    8: [4],    // Sco -> Can
    9: [12],   // Sag -> Pis
    10: [1, 11], // Cap -> Ari, Aqu
    11: [1],   // Aqu -> Ari
    12: [10]   // Pis -> Cap
};

// Planetary Friendship (Natural)
// Sun(0), Moon(1), Mars(2), Merc(3), Jup(4), Ven(5), Sat(6)
// Friend(1), Neutral(0), Enemy(-1)
export const GRAHA_MAITRI: number[][] = [
   // Su  Mo  Ma  Me  Ju  Ve  Sa
    [ 0,  1,  1,  0,  1, -1, -1], // Sun (Friends: Moon, Mars, Jup)
    [ 1,  0,  0,  1,  0,  0,  0], // Moon (Friends: Sun, Merc. No Enemies) -> Actually Moon has no enemies.
    // Standard:
    // Sun: Fr(Mo, Ma, Ju), Nu(Me), En(Ve, Sa)
    // Moon: Fr(Su, Me), Nu(Ma, Ju, Ve, Sa), En(-)
    // Mars: Fr(Su, Mo, Ju), Nu(Ve, Sa), En(Me)
    // Merc: Fr(Su, Ve), Nu(Ma, Ju, Sa), En(Mo)
    // Jup: Fr(Su, Mo, Ma), Nu(Sa), En(Me, Ve)
    // Ven: Fr(Me, Sa), Nu(Ma, Ju), En(Su, Mo)
    // Sat: Fr(Me, Ve), Nu(Ju), En(Su, Mo, Ma)
    
    // Using mapping: Friend=1, Neutral=0, Enemy=-1
    // Target Index:  0   1   2   3   4   5   6
    [ 0,  1,  1,  0,  1, -1, -1], // 0 Sun
    [ 1,  0,  0,  1,  0,  0,  0], // 1 Moon
    [ 1,  1,  0, -1,  1,  0,  0], // 2 Mars
    [ 1, -1,  0,  0,  0,  1,  0], // 3 Merc
    [ 1,  1,  1, -1,  0, -1,  0], // 4 Jup
    [-1, -1,  0,  1,  0,  0,  1], // 5 Ven
    [-1, -1, -1,  1,  0,  1,  0]  // 6 Sat
];

// Sign Lords (0=Sun...6=Sat)
export const SIGN_LORDS = [
    2, // Aries -> Mars
    5, // Taurus -> Venus
    3, // Gemini -> Merc
    1, // Cancer -> Moon
    0, // Leo -> Sun
    3, // Virgo -> Merc
    5, // Libra -> Venus
    2, // Scorpio -> Mars
    4, // Sag -> Jup
    6, // Cap -> Sat
    6, // Aqu -> Sat
    4  // Pis -> Jup
];

// Nadi Table (0=Adi, 1=Madhya, 2=Antya)
// North Style: Vata(Adi), Pitta(Madhya), Kapha(Antya)
// Pattern: 0 1 2 2 1 0 0 1 2...
export const NADI_TABLE: Nadi[] = [
    Nadi.Adi, Nadi.Madhya, Nadi.Antya, Nadi.Antya, Nadi.Madhya, Nadi.Adi,
    Nadi.Adi, Nadi.Madhya, Nadi.Antya, Nadi.Antya, Nadi.Madhya, Nadi.Adi,
    Nadi.Adi, Nadi.Madhya, Nadi.Antya, Nadi.Antya, Nadi.Madhya, Nadi.Adi,
    Nadi.Adi, Nadi.Madhya, Nadi.Antya, Nadi.Antya, Nadi.Madhya, Nadi.Adi,
    Nadi.Adi, Nadi.Madhya, Nadi.Antya
];

// Vashya Table (Sign 1-12 based)
export const VASHYA_SIGNS: Vashya[] = [
    Vashya.Chatuspada, // Aries
    Vashya.Chatuspada, // Taurus
    Vashya.Manava,     // Gemini
    Vashya.Jalachara,  // Cancer
    Vashya.Vanachara,  // Leo
    Vashya.Manava,     // Virgo
    Vashya.Manava,     // Libra
    Vashya.Keeta,      // Scorpio
    Vashya.Manava,     // Sagittarius (First half Manava) - Simplified
    Vashya.Jalachara,  // Capricorn (First half Chatuspada, Second Jala - taking Jala/Chatus based on common Ashta Kuta implementation, usually Chatuspada for first part is clearer but table often simplifies. Wikipedia Ashta Kuta says: Aries, Taurus, Sagittarius(2nd), Capricorn(1st) = Chatuspada. 
    // Wait, let's use standard table:
    // Aries: Chatuspada
    // Taurus: Chatuspada
    // Gemini: Manava
    // Cancer: Jalachara
    // Leo: Vanachara
    // Virgo: Manava
    // Libra: Manava (some say Balance, treated as Manava in 5 types)
    // Scorpio: Keeta
    // Sagittarius: Manava (upto 15?), Chatuspada (later?). Usually treated as Manava in basic table.
    // Capricorn: Chatuspada (1st half) / Jalachara (2nd). Often treated as Jalachara in matching due to Makara? Or Chatuspada. Let's use Chatuspada.
    // Aquarius: Manava
    // Pisces: Jalachara
    Vashya.Chatuspada, // Capricorn 
    Vashya.Manava,     // Aquarius
    Vashya.Jalachara   // Pisces
];

// Yoni Matrix (14x14) - Sexual Compatibility 0-4
// Indexes matches YoniAnimal enum:
// H, E, Sh, Sn, D, C, R, Co, B, T, Ha, M, L, Mo
export const YONI_MATRIX: number[][] = [
    [4, 2, 2, 3, 2, 2, 2, 1, 0, 1, 3, 2, 0, 2], // Horse
    [2, 4, 3, 3, 2, 2, 2, 2, 3, 1, 2, 3, 0, 2], // Elephant
    [2, 3, 4, 2, 1, 2, 1, 3, 3, 1, 2, 0, 3, 1], // Sheep
    [3, 3, 2, 4, 2, 1, 1, 1, 1, 2, 2, 2, 0, 0], // Snake
    [2, 2, 1, 2, 4, 2, 1, 2, 2, 1, 0, 2, 1, 1], // Dog
    [2, 2, 2, 1, 2, 4, 0, 2, 2, 1, 2, 3, 0, 2], // Cat
    [2, 2, 1, 1, 1, 0, 4, 2, 2, 1, 2, 2, 1, 2], // Rat
    [1, 2, 3, 1, 2, 2, 2, 4, 3, 0, 3, 2, 1, 2], // Cow
    [0, 3, 3, 1, 2, 2, 2, 3, 4, 1, 2, 2, 1, 2], // Buffalo
    [1, 1, 1, 2, 1, 1, 1, 0, 1, 4, 1, 1, 2, 1], // Tiger
    [3, 2, 2, 2, 0, 2, 2, 3, 2, 1, 4, 2, 2, 1], // Hare
    [2, 3, 0, 2, 2, 3, 2, 2, 2, 1, 2, 4, 2, 2], // Monkey
    [0, 0, 3, 0, 1, 0, 1, 1, 1, 2, 2, 2, 4, 2], // Lion
    [2, 2, 1, 0, 1, 2, 2, 2, 2, 1, 1, 2, 2, 4]  // Mongoose
];
