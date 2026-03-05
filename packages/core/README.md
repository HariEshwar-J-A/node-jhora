# @node-jhora/core

The foundation of the Node-Jhora Vedic astrology engine. Provides high-precision astronomical data via Swiss Ephemeris (WASM), fundamental Vedic math, and an ergonomic facade for common operations.

> Part of the [node-jhora](../../README.md) monorepo. [📖 Full Documentation](../../docs/CORE.md)

## Installation

```bash
npm install @node-jhora/core
```

> **Note**: Pure ESM — requires `"type": "module"` in your `package.json`.

## Quick Start

```typescript
import { NodeJHora } from '@node-jhora/core';

// One-line chart calculation
const chart = await NodeJHora.calculate(
    new Date('2000-01-01T12:00:00Z'),
    { latitude: 13.08, longitude: 80.27 },
    'Lahiri'
);

console.log("Ascendant:", chart.ascendant);
console.log("Moon Nakshatra:", chart.panchanga.nakshatra);
```

## Features

| Feature | Description |
| :--- | :--- |
| **Ephemeris Engine** | Swiss Ephemeris WASM — 0.0001″ accuracy |
| **NodeJHora Facade** | Static `calculate()` + instance API for ergonomic usage |
| **Panchanga** | Tithi, Nakshatra, Yoga, Karana, Vara |
| **16 Vargas** | D1–D60 divisional charts with `Decimal.js` precision |
| **House Systems** | Whole Sign, Placidus, Porphyry |
| **Special Lagnas** | Pranapada, Indu, Hora, Ghati, Bhava, Varnada |
| **Upagrahas** | Gulikadi (time-based) and Dhumadi (angular) |
| **KP System** | Sub-lord tables and Ruling Planets |
| **Geocoder** | Local CSV city lookup (coordinates + timezone) |
| **Planetary Stream** | Real-time observable for live chart updates |
| **Precision Math** | `Decimal.js` for all critical calculations |

## Exports

```typescript
// Facade
export { NodeJHora, init };

// Engine
export { EphemerisEngine, calculateHouseCusps, calculatePanchanga };

// Vedic
export { calculateVarga, calculateShashtyamsa, VargaDeities, getRelationship, PLANET_IDS };

// KP
export { KPSubLord, KPRuling };

// Special Lagnas
export { calculatePranapada, calculateInduLagna, calculateShreeLagna,
         calculateHoraLagna, calculateGhatiLagna, calculateBhavaLagna, calculateVarnadaLagna };

// Upagrahas
export { calculateTimeUpagrahas, calculateDhumadiUpagrahas };

// Math Utilities
export { normalize360, getShortestDistance, dmsToDecimal, decimalToDms };
export { D, toNum, normalize360D, NAKSHATRA_SPAN_D, DASHA_YEAR_DAYS };
export { AYANAMSA };

// Types
export type { PlanetPosition, HouseData, PanchangaResult, ChartData, VargaPoint,
              UpagrahaPositions, HouseSystemMethod, KPSignificator, RulingPlanetsResult,
              AyanamsaMode, NodeJHoraConfig, Ayanamsa };
```

## License

**© Copyright HariEshwar-J-A (Harieshwar Jagan Abirami).** All rights reserved.

This software is proprietary. For commercial use, enterprise integration, or any other use cases, explicit permission is required. Usage is subject to agreed-upon payment and licensing terms. Please contact the author for licensing inquiries.
