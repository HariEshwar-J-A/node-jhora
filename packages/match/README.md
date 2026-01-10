# Package: `@node-jhora/match`

The `@node-jhora/match` package provides algorithms for marriage compatibility based on the traditional Vedic **Kuta (Porutham)** system.

## 🤝 Porutham (10/12 Kutas)

The implementation currently supports the **South Indian (10 Porutham)** system, evaluating compatibility between two individuals based on their Birth Stars (Nakshatras) and Moon Signs.

### Supported Kutas
1.  **Dina**: Health and general prosperity.
2.  **Gana**: Temperamental compatibility (Deva, Manushya, Rakshasa).
3.  **Yoni**: Physical/sexual compatibility.
4.  **Rajju**: Mandatory check for the longevity of the couple (must not be in the same body region).
5.  *Note: Other kutas (Rasi, Vasya, Mahendra...) are planned for future versions.*

### Logic & Mandatory Rules
- **Rajju Dosha**: If both individuals share the same "Rajju" (Cord), the match is generally considered highly incompatible, regardless of the score.
- **Score Calculation**: Each Kuta has a specific weight. The final score is a sum of successful matches.

### Usage
```typescript
import { PoruthamMatch } from '@node-jhora/match';

// match(boyNak, girlNak, boySign, girlSign)
// Nakshatras: 0 (Ashwini) to 26 (Revati)
// Signs: 1 (Aries) to 12 (Pisces)
const result = PoruthamMatch.match(0, 1, 1, 2);

console.log(`Total Score: ${result.totalScore} / ${result.maxTotal}`);
console.log(`Recommended: ${result.isRecommended}`);

result.matches.forEach(kuta => {
    console.log(`${kuta.name}: ${kuta.description} (${kuta.score}/${kuta.maxScore})`);
});
```

---

## 🛠️ Data Tables
The package includes internal tables for:
- **Gana Table**: Mapping 27 stars to temperaments.
- **Yoni Table**: Mapping 27 stars to symbolic animals and their mutual enemies (e.g., Cat vs Rat).
- **Rajju Map**: Mapping 27 stars to body regions in a zig-zag pattern (Feet, Hip, Navel, Neck, Head).
