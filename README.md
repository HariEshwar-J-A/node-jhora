# Node-Jhora: Professional Vedic Astrology Monorepo

Node-Jhora is a high-precision, performance-oriented **Vedic Astrology (Jyotish)** engine for Node.js and TypeScript. It is structured as a monorepo containing specialized, lightweight packages for professional-grade astrology software.

## Features

*   **Precision Astronomy**: Uses Swiss Ephemeris (WASM) for planetary positions (0.0001" accuracy).
*   **Vedic Core**: Ayanamsa support, Panchanga, and all 16 Divisional Charts (Vargas).
*   **House Systems**: Placidus, Whole Sign, Equal House, and more.
*   **Jaimini System**: 7 Chara Karakas, Rashi Drishti, Arudha Padas, and Chara Dasha.
*   **KP System**: Sign, Star, Sub, and Sub-Sub Lords with Ruling Planets.
*   **Yoga Engine**: Extensible engine to detect planetary combinations.
*   **Predictive**: Vimshottari, Yogini, and Narayana Dasha systems.
*   **Analytics**: Complete Shadbala and Ashtakavarga calculation.
*   **Real-time Streams**: Observable streams for planetary updates.

## Packages

| Package | Description |
| :--- | :--- |
| [`@node-jhora/core`](./packages/core) | Core math, astronomoy, ephemeris engine, and Vedic foundations. ([Detailed Docs](./docs/CORE.md)) |
| [`@node-jhora/analytics`](./packages/analytics) | Shadbala, Ashtakavarga, and Yoga engines. ([Detailed Docs](./docs/ANALYTICS.md)) |
| [`@node-jhora/prediction`](./packages/prediction) | Dashas (Vimshottari, Yogini, Narayana) and Transit scanners. ([Detailed Docs](./docs/PREDICTION.md)) |
| [`@node-jhora/match`](./packages/match) | Kuta-based marriage compatibility (Porutham). ([Detailed Docs](./docs/MATCHMAKING.md)) |

## Detailed Technical Documentation

For in-depth explanations of the engine's internals, refer to the following guides:

*   **[Architecture Overview](./docs/ARCHITECTURE.md)**: Monorepo design, package boundaries, and build system.
*   **[Mathematical Foundation](./docs/MATH.md)**: Spherical geometry, Topocentric parallax, and interpolation logic.
*   **[Core Engine Guide](./docs/CORE.md)**: Swiss Ephemeris (WASM) setup, Geocoding, and Panchanga fundamentals.
*   **[Analytics & Strengths](./docs/ANALYTICS.md)**: Shadbala, Ashtakavarga, and the Yoga Rule Engine.
*   **[Predictive Logic](./docs/PREDICTION.md)**: Dasha systems, Transit scanners, and Jaimini astrology.
*   **[Matchmaking (Kuta)](./docs/MATCHMAKING.md)**: Marriage compatibility scoring and mandatory rules (Rajju).

## Installation

```bash
# Core engine (Required)
npm install @node-jhora/core

# Feature packages (Optional)
npm install @node-jhora/analytics @node-jhora/prediction @node-jhora/match
```

**Note**: This project is pure ESM. Ensure your `package.json` has `"type": "module"`.

## Quick Start (Core Layer)

```typescript
import { EphemerisEngine, DateTime } from '@node-jhora/core';

async function main() {
    const eph = EphemerisEngine.getInstance();
    await eph.initialize();

    const date = DateTime.fromISO('2000-01-01T12:00:00Z');
    const planets = eph.getPlanets(date);
    
    console.log("Sun Longitude:", planets.find(p => p.id === 0)?.longitude);
}

main();
```

## Modules Guide

### 1. Analytics (Shadbala & Yogas)
```typescript
import { calculateShadbala, YogaEngine } from '@node-jhora/analytics';
// Use with @node-jhora/core's ChartData
```

### 2. Predictive (Dashas & Transits)
```typescript
import { generateVimshottari, NarayanaDasha } from '@node-jhora/prediction';
```

### 3. Matchmaking (Porutham)
```typescript
import { PoruthamMatch } from '@node-jhora/match';
// match(boyNak, girlNak, boySign, girlSign)
const result = PoruthamMatch.match(0, 1, 1, 2); 
```

## Contributing

We welcome contributions! The project uses an NPM workspaces monorepo structure.

**Build all packages:**
```bash
npm run build
```

**Run all tests:**
```bash
# Run tests for a specific package
npx jest --config packages/core/jest.config.js
```

## License

**Source Available - Commercial License Required**.
Copyright (c) 2026 Harieshwar Jagan Abirami. All Rights Reserved.

*   **Public Access**: Source code is available for inspection and education.
*   **Restricted Use**: Usage, distribution, and **derivative works** are strictly prohibited without a Commercial License.
*   Contact the owner to negotiate licensing terms. See [LICENSE](LICENSE).
