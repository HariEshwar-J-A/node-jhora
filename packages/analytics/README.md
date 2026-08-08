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

**© Copyright HariEshwar-J-A (Harieshwar Jagan Abirami).** All rights reserved.

This software is proprietary. For commercial use, enterprise integration, or any other use cases, explicit permission is required. Usage is subject to agreed-upon payment and licensing terms. Please contact the author for licensing inquiries.

## Configuration

Every calculation choice is explicit and overridable at three levels —
library default, instance default, per-call override. Nothing is hidden in a
constant.

```
library default  →  instance default  →  per-call override
   (weakest)                                 (strongest)
```

Key options: `ayanamsaMode` (default `27`, True Chitrapaksha), `positionMode`
(`'geometric'`), `nodeType` (`'true'`), `houseSystem` (`'WholeSign'`),
`dasamsaScheme` (`'parashara'`, per BPHS), `topocentric`, `ayanamsaOffset`,
`sunriseHour`.

```ts
import { NodeJHora, JHORA_PRESET } from '@node-jhora/core';

// Library defaults: Drik Siddhanta astronomy, True Chitrapaksha, BPHS rules
const chart = new NodeJHora(location);

// Or reproduce Jagannatha Hora exactly
const jhora = new NodeJHora(location, JHORA_PRESET);
```

Full reference: [CONFIGURATION.md](../../CONFIGURATION.md) ·
Measured accuracy: [docs/ACCURACY.md](../../docs/ACCURACY.md)

## Accuracy

Validated against **JPL Horizons** (≤ 0.28″, 1900–2024) and against a real
**JHora** export (D1 to 0.01″, ascendant 0.00″). Scored against Horizons as an
independent referee, node-jhora is closer than JHora's own stored values on
4 of 4 legacy charts.
