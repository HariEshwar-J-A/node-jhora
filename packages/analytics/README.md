# @node-jhora/analytics

Depth and strength analysis layer for the Node-Jhora Vedic astrology engine. Provides Shadbala (6-fold planetary strength), Ashtakavarga (BAV/SAV grids), an extensible Yoga detection engine, and KP Engine significators.

> Part of the [node-jhora](../../README.md) monorepo. [📖 Full Documentation](../../docs/ANALYTICS.md)

## Installation

```bash
npm install @node-jhora/analytics @node-jhora/core
```

## Quick Start

```typescript
import { calculateShadbala, Ashtakavarga, YogaEngine, YOGA_LIBRARY } from '@node-jhora/analytics';

// Shadbala — 6-fold planetary strength (Virupas)
const strength = calculateShadbala({ planet, allPlanets, houses, sun, moon, timeDetails, vargaPositions });

// Ashtakavarga — BAV/SAV grids
const av = Ashtakavarga.calculate(planets, ascendantSign);

// Yogas — detect planetary combinations
const yogas = YogaEngine.findYogas(chartData, YOGA_LIBRARY);
```

## Features

| Feature | Description |
| :--- | :--- |
| **Shadbala** | Full Parashara 6-fold strength (Sthana, Dig, Kaala, Chesta, Naisargika, Drig) |
| **Ashtakavarga** | Bhinnashtakavarga (BAV) and Sarvashtakavarga (SAV) |
| **Yoga Engine** | Rule-based, extensible via JSON-compatible `YogaDef` definitions |
| **YOGA_LIBRARY** | Built-in library of standard Raja, Dhana, Nabhasa Yogas |
| **KP Engine** | Extended KP planet and house significator analysis |
| **Aspects** | Aspect strength calculations for Drig Bala |

## Exports

```typescript
export { calculateShadbala, Ashtakavarga, YogaEngine, YOGA_LIBRARY, KPEngine };
export type { ShadbalaResult, VargaInfo, AshtakavargaResult, ChartData,
              KPPlanetSignificator, KPHouseSignificator, YogaDef, YogaResult };
```

## License

Source Available — Commercial License Required. See [LICENSE](../../LICENSE).
