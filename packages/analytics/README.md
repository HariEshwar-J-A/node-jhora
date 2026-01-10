# Package: `@node-jhora/analytics`

The `@node-jhora/analytics` package provides deep insights into planetary strengths, mathematical patterns (Ashtakavarga), and combination detection (Yogas).

## 💪 Shadbala (Six-fold Strength)

A complete implementation of the complex Parashari Shadbala system.

### Calculation Components
Shadbala is calculated in **Virupas** (points) and consists of:
1.  **Sthana Bala** (Positional): Uchcha, Saptavargaja, Kendra, Ojayugma.
2.  **Dig Bala** (Directional): Strength based on proximity to specific house cusps.
3.  **Kaala Bala** (Temporal): Natonata, Paksha, Tribhaga, Ayanabala.
4.  **Chesta Bala** (Motional): Based on planetary speed and retrograde status.
5.  **Naisargika Bala** (Natural): Constant strength inherent to each planet.
6.  **Drig Bala** (Aspect): Strength derived from benefic and malefic aspects.

### Usage
```typescript
import { calculateShadbala } from '@node-jhora/analytics';

const result = calculateShadbala({
    planet, allPlanets, houses, sun, moon,
    timeDetails: { sunrise, sunset, birthHour },
    vargaPositions // D1, D2, D3, D7, D9, D12, D30 for Saptavargaja
});

console.log(`Total Shadbala: ${result.total} Virupas`);
console.log(`Ishta Phala: ${result.ishtaPhala}`);
```

---

## 🔢 Ashtakavarga

Calculates the "Eight-fold Grids" for planets and the combined Sarvashtakavarga (SAV).

```typescript
import { Ashtakavarga } from '@node-jhora/analytics';

const result = Ashtakavarga.calculate(planets, ascendantSign);

// BAV for Sun
console.log("Sun BAV:", result.bav[0]); 
// Sarvashtakavarga (SAV)
console.log("SAV Points:", result.sav); // Array of 12 scores
```

---

## 🧘 Yoga Engine

A powerful, rule-based engine to identify hundreds of planetary yogas.

### Configuration
Yogas are defined using a structured `YogaDefinition` interface:
```typescript
interface YogaDefinition {
    name: string;
    category: 'Raja' | 'Dhana' | 'Nabhasa' | 'Other';
    conditions: Condition[]; // Logical AND of conditions
}
```

**Supported Conditions:**
- `placement`: Planet in specific house or sign.
- `aspect`: Aspect from Planet A to Planet B.
- `conjunction`: Multiple planets in the same sign.
- `lordship`: Lord of House X placed in House Y.

### Usage
```typescript
import { YogaEngine, YOGA_LIBRARY } from '@node-jhora/analytics';

const foundYogas = YogaEngine.findYogas(chartData, YOGA_LIBRARY);
console.log("Detected Yogas:", foundYogas);
```

## 🏷️ Keywords
Shadbala, Ashtakavarga, Yoga Engine, Planetary Strength, Vedic Astrology, Jyotish, Parashara, BAV, SAV, Raja Yoga, Astrology Analytics, Bhava Bala, Dig Bala

