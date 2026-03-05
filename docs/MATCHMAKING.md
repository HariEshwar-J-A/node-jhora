# Package: `@node-jhora/match`

The `@node-jhora/match` package provides comprehensive marriage compatibility analysis using traditional Vedic **Kuta** systems and Dosha assessment. It supports both the **North Indian (Ashta Kuta, 36-point)** and **South Indian (Dasha Kuta / 10 Poruthams)** systems, plus **Mangal Dosha** analysis.

---

## 🔵 Ashta Kuta — North Indian System (36 Points)

The **Ashta Kuta** (Eight Kutas) system is the standard North Indian compatibility method, scoring a maximum of **36 points** across 8 categories.

### The 8 Kutas

| # | Kuta | Max Points | What it Assesses |
| :---: | :--- | :---: | :--- |
| 1 | **Varna** | 1 | Spiritual compatibility (Brahmin > Kshatriya > Vaishya > Shudra) |
| 2 | **Vashya** | 2 | Mutual attraction and dominance |
| 3 | **Tara** | 3 | Birth star harmony (Nakshatra distance mod 9) |
| 4 | **Yoni** | 4 | Physical / sexual compatibility (14 symbolic animals) |
| 5 | **Graha Maitri** | 5 | Planetary friendship between Moon-sign lords |
| 6 | **Gana** | 6 | Temperamental match (Deva, Manushya, Rakshasa) |
| 7 | **Bhakoot** | 7 | Financial prosperity and family welfare (sign distance) |
| 8 | **Nadi** | 8 | Health and genetic compatibility (Adi, Madhya, Antya) |

### Usage

```typescript
import { calculateAshtaKuta } from '@node-jhora/match';
import type { MatchResult } from '@node-jhora/match';

const result: MatchResult = calculateAshtaKuta(
    boyStar,   // Nakshatra index (0-26, Ashwini to Revati)
    girlStar,  // Nakshatra index (0-26)
    boySign,   // Moon sign (1-12, Aries to Pisces)
    girlSign   // Moon sign (1-12)
);

console.log(`System: ${result.system}`);       // 'AshtaKuta'
console.log(`Score: ${result.totalScore}/36`);
console.log(`Compatible: ${result.isCompatible}`); // true if score >= 18

result.matches.forEach(kuta => {
    console.log(`  ${kuta.name}: ${kuta.score}/${kuta.maxScore} — ${kuta.description}`);
});
```

### Compatibility Threshold

A match is generally considered compatible when the total score is **≥ 18 out of 36** (50%).

---

## 🟢 Dasha Kuta — South Indian System (10 Poruthams)

The **Dasha Kuta** system evaluates 10 compatibility factors with additional critical checks (Vedha and Rajju).

### The 10 Poruthams

| # | Kuta | What it Assesses |
| :---: | :--- | :--- |
| 1 | **Dina** | Health and general prosperity |
| 2 | **Gana** | Temperamental compatibility (Deva, Manushya, Rakshasa) |
| 3 | **Yoni** | Physical / sexual compatibility |
| 4 | **Rasi** | Rasi-based harmony (Moon sign distance) |
| 5 | **Rasyadhipathi** | Lord friendship |
| 6 | **Vashya** | Attraction and loyalty |
| 7 | **Mahendra** | Prosperity and progeny |
| 8 | **Stree Deergha** | Marital bliss (boy's star count from girl's star) |
| 9 | **Rajju** | ⚠️ **Mandatory** — longevity of couple (body region match) |
| 10 | **Vedha** | ⚠️ **Mutual obstruction** — Nakshatra pair check |

### Usage

```typescript
import { calculateDashaKuta } from '@node-jhora/match';
import type { MatchResult } from '@node-jhora/match';

const result: MatchResult = calculateDashaKuta(
    boyStar,   // 0-26
    girlStar,  // 0-26
    boySign,   // 1-12
    girlSign   // 1-12
);

console.log(`System: ${result.system}`);           // 'DashaKuta'
console.log(`Score: ${result.totalScore}/${result.maxScore}`);
console.log(`Rajju Mismatch: ${result.isRajjuMismatch}`);  // Critical!
console.log(`Vedha Mismatch: ${result.isVedhaMismatch}`);  // Critical!
console.log(`Compatible: ${result.isCompatible}`);
```

### Critical Disqualifiers

- **Rajju Dosha**: If both partners share the same Rajju (body cord region: Head, Neck, Navel, Hip, or Feet), the match is traditionally rejected regardless of score.
- **Vedha Dosha**: Specific Nakshatra pairs are considered mutually obstructive — if both partners have Vedha Nakshatras, the match is rejected.

### Rajju Body Regions

The 27 Nakshatras are mapped in a zig-zag pattern across 5 body regions:

| Region | Pattern | Stars (1-based) |
| :--- | :--- | :--- |
| Pada (Feet) | ↑ | 1, 10, 19 |
| Kati (Hip) | ↑ | 2, 11, 20 |
| Nabhi (Navel) | ↑ | 3, 12, 21 |
| Kanta (Neck) | ↑ | 4, 13, 22 |
| Shiro (Head) | ↑↓ | 5, 6, 14, 15, 23, 24 |

---

## 🟡 Porutham (Simple South Indian Match)

A simpler 4-kuta matcher for quick compatibility checks:

```typescript
import { PoruthamMatch } from '@node-jhora/match';
import type { CompatibilityResult, KutaScore } from '@node-jhora/match';

const result: CompatibilityResult = PoruthamMatch.match(
    boyNak,    // 0-26
    girlNak,   // 0-26
    boySign,   // 1-12
    girlSign   // 1-12
);

console.log(`Score: ${result.totalScore}/${result.maxTotal}`);
console.log(`Recommended: ${result.isRecommended}`); // Score > 50% AND Rajju pass

result.matches.forEach(kuta => {
    console.log(`  ${kuta.name}: ${kuta.score}/${kuta.maxScore} — ${kuta.description}`);
});
```

**Kutas evaluated:** Dina (1pt), Gana (4pt), Yoni (4pt), Rajju (1pt mandatory).

---

## 🔴 Mangal Dosha (Mars Defect)

Checks for Mars placement in houses 1, 2, 4, 7, 8, or 12 from Lagna, Moon, and Venus — a traditional deal-breaker in marriage compatibility.

```typescript
import { checkMangalDosha } from '@node-jhora/match';
import type { DoshaResult } from '@node-jhora/match';

const result: DoshaResult = checkMangalDosha(boyChart, girlChart);

console.log(`Boy has Dosha: ${result.boyHasDosha}`);
console.log(`Girl has Dosha: ${result.girlHasDosha}`);
console.log(`Status: ${result.matchStatus}`);
// 'None'    — Neither has dosha
// 'Cancel'  — Both have dosha (neutralized)
// 'Present' — Only one has dosha (problematic)
console.log(`Details: ${result.exceptions?.join(', ')}`);
```

### Exception Rules

The following conditions **cancel** Mangal Dosha even if Mars is in a dosha house:
- **Own House**: Mars in Aries (1) or Scorpio (8).
- **Exalted**: Mars in Capricorn (10).
- **Both Match**: If both partners have Mangal Dosha, the doshas neutralize each other.

---

## 🛠️ Types & Enums

The package exports comprehensive type definitions for all matching logic:

```typescript
import type { MatchSystem, KutaScore, DoshaResult, MatchResult } from '@node-jhora/match';

type MatchSystem = 'AshtaKuta' | 'DashaKuta';

interface MatchResult {
    system: MatchSystem;
    totalScore: number;
    maxScore: number;
    isCompatible: boolean;
    isRajjuMismatch?: boolean;
    isVedhaMismatch?: boolean;
    matches: KutaScore[];
    dosha?: DoshaResult;
}
```

### Vedic Enums

```typescript
import { Gana, YoniAnimal, Nadi, Rajju, Varna, Vashya } from '@node-jhora/match';

// Gana: Deva (0), Manushya (1), Rakshasa (2)
// YoniAnimal: Horse (0), Elephant (1), Sheep (2), Snake (3), ...Lion (12), Mongoose (13)
// Nadi: Adi/Vata (0), Madhya/Pitta (1), Antya/Kapha (2)
// Rajju: Shiro/Head (0), Kanta/Neck (1), Nabhi/Navel (2), Kati/Hip (3), Pada/Foot (4)
// Varna: Brahmin (0), Kshatriya (1), Vaishya (2), Shudra (3)
// Vashya: Chatuspada (0), Manava (1), Jalachara (2), Vanachara (3), Keeta (4)
```

---

## 🗂️ Data Tables

The package includes comprehensive internal tables powering all calculations:

- **Gana Table** (27 entries): Mapping each Nakshatra to Deva/Manushya/Rakshasa.
- **Yoni Table** (27 entries): Mapping each Nakshatra to one of 14 symbolic animals.
- **Yoni Matrix** (14×14): Compatibility scores between all animal pairs.
- **Nadi Table** (27 entries): Mapping Nakshatras to Adi/Madhya/Antya.
- **Graha Maitri**: Planetary friendship matrix (Friend +1, Neutral 0, Enemy -1).
- **Sign Lords** (12): Ruling planet for each zodiac sign.
- **Vashya Pairs**: Sign-level attraction compatibility pairs.
- **Vedha Pairs**: Mutually obstructive Nakshatra pairs.
- **Rajju Map**: Zig-zag body-region mapping for 27 Nakshatras.

---

## 📋 Full Export Reference

```typescript
// Classes & Functions
export { PoruthamMatch, calculateAshtaKuta, calculateDashaKuta, checkMangalDosha };

// Types
export type { MatchSystem, MatchResult, KutaScore, DoshaResult, CompatibilityResult };

// Enums
export { Gana, YoniAnimal, Nadi, Rajju, Varna, Vashya };
```
