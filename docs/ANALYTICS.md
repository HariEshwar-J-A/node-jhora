# Package: `@node-jhora/analytics`

The `@node-jhora/analytics` package provides deep insights into planetary strengths, mathematical patterns (Ashtakavarga), combination detection (Yogas), and extended KP significator analysis.

---

## 💪 Shadbala (Six-fold Strength)

A complete implementation of the Parashari Shadbala system, calculating planetary strength in **Virupas** (points).

### Calculation Components

| # | Bala | Description |
| :---: | :--- | :--- |
| 1 | **Sthana Bala** (Positional) | Uchcha, Saptavargaja (7 Varga strengths), Kendra, Ojayugma |
| 2 | **Dig Bala** (Directional) | Strength based on proximity to specific house cusps |
| 3 | **Kaala Bala** (Temporal) | Natonata, Paksha, Tribhaga, Ayanabala, Yuddha Bala |
| 4 | **Chesta Bala** (Motional) | Based on planetary speed, retrograde, and combustion status |
| 5 | **Naisargika Bala** (Natural) | Constant inherent strength for each planet |
| 6 | **Drig Bala** (Aspect) | Net strength from benefic and malefic planetary aspects |

### Usage

```typescript
import { calculateShadbala } from '@node-jhora/analytics';
import type { ShadbalaResult, VargaInfo } from '@node-jhora/analytics';

const vargaPositions: VargaInfo[] = [
    { vargaName: 'D1', sign: 5, lordId: 0, lordRashiSign: 5 },
    { vargaName: 'D2', sign: 3, lordId: 2, lordRashiSign: 3 },
    { vargaName: 'D3', sign: 9, lordId: 5, lordRashiSign: 9 },
    { vargaName: 'D7', sign: 1, lordId: 4, lordRashiSign: 1 },
    { vargaName: 'D9', sign: 7, lordId: 3, lordRashiSign: 7 },
    { vargaName: 'D12', sign: 2, lordId: 3, lordRashiSign: 2 },
    { vargaName: 'D30', sign: 10, lordId: 6, lordRashiSign: 10 },
];

const result: ShadbalaResult = calculateShadbala({
    planet,         // PlanetPosition — target planet
    allPlanets,     // PlanetPosition[] — all 9 planets
    houses,         // HouseData — house cusps
    sun,            // PlanetPosition — Sun data
    moon,           // PlanetPosition — Moon data
    timeDetails: {
        sunrise: 6,   // Hour (24h format)
        sunset: 18,
        birthHour: 14
    },
    vargaPositions  // VargaInfo[] — D1, D2, D3, D7, D9, D12, D30
});

console.log(`Total Shadbala: ${result.total.toFixed(2)} Virupas`);
console.log(`Ishta Phala: ${result.ishtaPhala}`);
```

---

## 🔢 Ashtakavarga

Calculates the **Eight-fold Grids** — Bhinnashtakavarga (BAV) for individual planets and the combined Sarvashtakavarga (SAV).

```typescript
import { Ashtakavarga } from '@node-jhora/analytics';
import type { AshtakavargaResult } from '@node-jhora/analytics';

const result: AshtakavargaResult = Ashtakavarga.calculate(planets, ascendantSign);

// BAV for Sun (12 sign scores)
console.log("Sun BAV:", result.bav[0]);

// Sarvashtakavarga — combined scores per sign
console.log("SAV Points:", result.sav); // number[12]
```

---

## 🧘 Yoga Engine

A powerful, rule-based engine to identify hundreds of planetary yogas (Raja, Dhana, Nabhasa, and more).

### Yoga Definitions

Yogas are defined using the `YogaDef` interface — JSON-compatible for custom definitions:

```typescript
import type { YogaDef, YogaResult } from '@node-jhora/analytics';

interface YogaDef {
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
import type { ChartData } from '@node-jhora/analytics';

// Use the built-in library of yoga definitions
const foundYogas: YogaResult[] = YogaEngine.findYogas(chartData, YOGA_LIBRARY);

foundYogas.forEach(yoga => {
    console.log(`${yoga.name} (${yoga.category}): ${yoga.description}`);
});
```

### Custom Yogas

Add your own Yoga definitions without modifying engine code:

```typescript
const customYoga: YogaDef = {
    name: 'My Custom Yoga',
    category: 'Raja',
    conditions: [
        { type: 'placement', planetId: 5, houses: [1, 5, 9] }, // Jupiter in trine
        { type: 'lordship', houseFrom: 9, houseTo: 1 }          // 9th lord in 1st
    ]
};

const results = YogaEngine.findYogas(chartData, [...YOGA_LIBRARY, customYoga]);
```

---

## 🔮 KP Engine

Extended Krishnamurti Paddhati significator analysis for deeper KP-based predictions.

```typescript
import { KPEngine } from '@node-jhora/analytics';
import type { KPPlanetSignificator, KPHouseSignificator } from '@node-jhora/analytics';

// Compute KP planet and house significators
// Use alongside @node-jhora/core's KPSubLord for sub-lord tables
```

The `KPEngine` provides:
- **Planet Significators** (`KPPlanetSignificator`): Houses signified by each planet through ownership, occupation, and star-lordship.
- **House Significators** (`KPHouseSignificator`): Planets signifying each house through the same chain.

---

## 📊 Aspects

Detailed aspect strength calculations between planets:

```typescript
// Internal module: aspects.ts
// Provides aspect strength computation for Drig Bala in Shadbala
// and aspect condition checking in the Yoga Engine
```
