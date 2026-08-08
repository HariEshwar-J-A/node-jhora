# @node-jhora/match

Comprehensive Vedic marriage compatibility analysis. Supports **North Indian Ashta Kuta** (36-point), **South Indian Dasha Kuta** (10 Poruthams), and **Mangal Dosha** assessment.

> Part of the [node-jhora](../../README.md) monorepo. [📖 Full Documentation](../../docs/MATCHMAKING.md)

## Installation

```bash
npm install @node-jhora/match @node-jhora/core
```

## Quick Start

```typescript
import { calculateAshtaKuta, calculateDashaKuta, PoruthamMatch, checkMangalDosha } from '@node-jhora/match';

// North Indian — Ashta Kuta (36 points max)
const north = calculateAshtaKuta(boyStar, girlStar, boySign, girlSign);
console.log(`Score: ${north.totalScore}/36 — ${north.isCompatible ? '✅' : '❌'}`);

// South Indian — Dasha Kuta (10 Poruthams)
const south = calculateDashaKuta(boyStar, girlStar, boySign, girlSign);

// Simple Porutham (4 kutas)
const simple = PoruthamMatch.match(boyStar, girlStar, boySign, girlSign);

// Mangal Dosha
const dosha = checkMangalDosha(boyChart, girlChart);
console.log(`Status: ${dosha.matchStatus}`); // 'None' | 'Present' | 'Cancel'
```

## Features

| Feature | Description |
| :--- | :--- |
| **Ashta Kuta (North)** | 8 kutas: Varna, Vashya, Tara, Yoni, Graha Maitri, Gana, Bhakoot, Nadi (36 pts) |
| **Dasha Kuta (South)** | 10 Poruthams with Vedha pairs and Rajju dosha critical checks |
| **Porutham (Simple)** | Quick 4-kuta check: Dina, Gana, Yoni, Rajju |
| **Mangal Dosha** | Mars in houses 1/2/4/7/8/12 from Lagna, Moon, Venus with exceptions |
| **Typed Enums** | Gana, YoniAnimal, Nadi, Rajju, Varna, Vashya |
| **Data Tables** | Gana, Yoni (14×14 matrix), Nadi, Graha Maitri, Sign Lords, Vedha Pairs |

## Exports

```typescript
export { PoruthamMatch, calculateAshtaKuta, calculateDashaKuta, checkMangalDosha };
export { Gana, YoniAnimal, Nadi, Rajju, Varna, Vashya };
export type { MatchSystem, MatchResult, KutaScore, DoshaResult, CompatibilityResult };
```

> [!NOTE]
> The Kuta system implements standard matching rules per BPHS and standard North/South texts. Kalamrita-specific exceptions are not enforced to maintain broad compatibility.

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
