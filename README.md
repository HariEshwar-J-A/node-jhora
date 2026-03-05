# Node-Jhora: Professional Vedic Astrology SDK

Node-Jhora is a high-precision, performance-oriented **Vedic Astrology (Jyotish)** engine for Node.js and TypeScript. It is structured as a monorepo containing specialized, lightweight packages for professional-grade astrology software.

## ✨ Features

*   **Precision Astronomy**: Swiss Ephemeris (WASM) for planetary positions with 0.0001″ accuracy.
*   **Vedic Core**: Ayanamsa support (Lahiri, Raman, KP, and more), Panchanga (Tithi/Nakshatra/Yoga/Karana/Vara), and all 16 Divisional Charts (Vargas D1–D60).
*   **House Systems**: Whole Sign, Placidus, and Porphyry with trigonometric Ascendant/MC calculation.
*   **Special Lagnas**: Pranapada, Indu Lagna, Hora Lagna, Ghati Lagna, Bhava Lagna, and Varnada Lagna.
*   **Upagrahas**: Gulikadi (time-based: Gulika, Mandi, Kaala, etc.) and Dhumadi (angular: Dhuma, Vyatipata, etc.).
*   **Jaimini System**: 7 Chara Karakas, Rashi Drishti, Arudha Padas, and Chara Dasha.
*   **KP System**: Sign, Star, Sub, and Sub-Sub Lords with Ruling Planets and KP Engine significators.
*   **Yoga Engine**: Extensible, rule-based engine to detect hundreds of planetary combinations.
*   **Predictive**: Vimshottari (5-level recursive), Yogini, and Narayana Dasha systems.
*   **Analytics**: Complete Shadbala (6-fold strength) and Ashtakavarga (BAV/SAV) calculation.
*   **Matchmaking**: North Indian Ashta Kuta (36 points), South Indian Dasha Kuta (10 Poruthams), and Mangal Dosha analysis.
*   **REST API**: Production-ready Fastify server with Zod validation for all calculations.
*   **Event Detection**: Precision event scanners for sign ingresses, retrograde stations, and custom conditions.
*   **PDF Reports**: Full birth chart reports with Shadbala, Yogas, and chart drawings via PDFKit.
*   **Precision Math**: All core calculations use `Decimal.js` to eliminate floating-point drift.
*   **Real-time Streams**: Observable streams for live planetary position updates.

## 📦 Packages

| Package | Description |
| :--- | :--- |
| [`@node-jhora/core`](./packages/core) | Ephemeris engine, Vedic math, Panchanga, Vargas, KP, houses, and streams. ([Docs](./docs/CORE.md)) |
| [`@node-jhora/analytics`](./packages/analytics) | Shadbala, Ashtakavarga, Yoga engine, and KP Engine. ([Docs](./docs/ANALYTICS.md)) |
| [`@node-jhora/prediction`](./packages/prediction) | Dashas (Vimshottari, Yogini, Narayana), transits, and Jaimini predictive tools. ([Docs](./docs/PREDICTION.md)) |
| [`@node-jhora/match`](./packages/match) | Ashta Kuta, Dasha Kuta (Porutham), and Mangal Dosha compatibility. ([Docs](./docs/MATCHMAKING.md)) |
| [`@node-jhora/events`](./packages/events) | Precision transit scanner for ingresses, stations, and custom events. ([Docs](./docs/EVENTS.md)) |
| [`@node-jhora/reporting`](./packages/reporting) | PDF report generation with chart drawings, Shadbala, and Yogas. ([Docs](./docs/REPORTING.md)) |
| [`@node-jhora/api`](./packages/api) | Production-ready REST API server (Fastify + Zod). ([Docs](./docs/API.md)) |

## 📖 Detailed Technical Documentation

*   **[Architecture Overview](./docs/ARCHITECTURE.md)**: Monorepo design, package boundaries, and build system.
*   **[Mathematical Foundation](./docs/MATH.md)**: Spherical geometry, precision math, interpolation, and event detection algorithms.
*   **[Core Engine Guide](./docs/CORE.md)**: Swiss Ephemeris (WASM) setup, NodeJHora facade, Panchanga, Special Lagnas, and Upagrahas.
*   **[Analytics & Strengths](./docs/ANALYTICS.md)**: Shadbala, Ashtakavarga, Yoga Rule Engine, and KP Engine.
*   **[Predictive Logic](./docs/PREDICTION.md)**: Dasha systems, Transit scanners, and Jaimini astrology.
*   **[Matchmaking (Kuta)](./docs/MATCHMAKING.md)**: Ashta Kuta (North), Dasha Kuta (South), and Mangal Dosha.
*   **[REST API Reference](./docs/API.md)**: Fastify endpoints, Zod schemas, and request/response examples.
*   **[Event Detection](./docs/EVENTS.md)**: TransitScanner for ingresses, retrograde stations, and custom event solving.
*   **[PDF Reporting](./docs/REPORTING.md)**: Full birth chart PDF report generation.
*   **[Market Positioning](./docs/MARKET_POSITION.md)**: Comparison with standard libraries and enterprise APIs.

## 🚀 Installation

```bash
# Core engine (Required)
npm install @node-jhora/core

# Feature packages (Optional)
npm install @node-jhora/analytics @node-jhora/prediction @node-jhora/match
npm install @node-jhora/events @node-jhora/reporting @node-jhora/api
```

> [!NOTE]
> This project is pure ESM. Ensure your `package.json` has `"type": "module"`.

## ⚡ Quick Start

### Static API (Simplest — One Call)

```typescript
import { NodeJHora } from '@node-jhora/core';

const chart = await NodeJHora.calculate(
    new Date('2000-01-01T12:00:00Z'),
    { latitude: 13.08, longitude: 80.27 }, // Chennai
    'Lahiri' // Ayanamsa: 'Lahiri' | 'Raman' | 'KP'
);

console.log("Ascendant:", chart.ascendant);
console.log("Sun:", chart.planets.find(p => p.id === 0)?.longitude);
console.log("Moon Nakshatra:", chart.panchanga.nakshatra);
```

### Instance API (Full Control)

```typescript
import { NodeJHora } from '@node-jhora/core';
import { DateTime } from 'luxon';

const jhora = new NodeJHora(
    { latitude: 13.08, longitude: 80.27 },
    { ayanamsaOrder: 1, topocentric: true }
);
await jhora.init();

const date = DateTime.fromISO('2000-01-01T12:00:00Z');
const chart = jhora.getChart(date);       // Planets + Houses
const panchanga = jhora.getPanchanga(date); // Tithi, Nakshatra, Yoga, Karana, Vara
```

### Functional API (Granular)

```typescript
import { EphemerisEngine, calculateHouseCusps, calculatePanchanga } from '@node-jhora/core';
import { DateTime } from 'luxon';

const engine = EphemerisEngine.getInstance();
await engine.initialize();

const dt = DateTime.now();
const planets = engine.getPlanets(dt, { latitude: 13.08, longitude: 80.27 }, { ayanamsaOrder: 1 });
const houses = calculateHouseCusps(dt, 13.08, 80.27, 'WholeSign', engine);
```

## 📐 Modules Guide

### 1. Analytics (Shadbala, Ashtakavarga & Yogas)

```typescript
import { calculateShadbala, Ashtakavarga, YogaEngine, YOGA_LIBRARY, KPEngine } from '@node-jhora/analytics';

// Shadbala — 6-fold planetary strength
const strength = calculateShadbala({
    planet, allPlanets, houses, sun, moon,
    timeDetails: { sunrise, sunset, birthHour },
    vargaPositions
});
console.log(`Total: ${strength.total} Virupas`);

// Ashtakavarga — BAV/SAV grids
const avResult = Ashtakavarga.calculate(planets, ascendantSign);

// Yogas — detect planetary combinations
const yogas = YogaEngine.findYogas(chartData, YOGA_LIBRARY);
```

### 2. Predictive (Dashas, Transits & Jaimini)

```typescript
import {
    generateVimshottari, calculateDashaBalance,
    YoginiDasha, NarayanaDasha,
    TransitEngine, JaiminiCore, JaiminiDashas
} from '@node-jhora/prediction';

// Vimshottari — 120-year cycle, 5 recursive levels
const dashas = generateVimshottari(birthDate, moonLongitude, 5);

// Yogini — 8-year recurring cycles
const yogini = YoginiDasha.calculate(moonLongitude, birthDate, 80);

// Jaimini — Chara Karakas and Chara Dasha
const karakas = JaiminiCore.calculateKarakas(planets);
const charaDasha = JaiminiDashas.calculateCharaDasha(lagnaSign, planets);

// Transit scanning with Newton-Raphson precision
const engine = new TransitEngine();
const events = await engine.findTransits(0, startDate, endDate);
```

### 3. Matchmaking (Ashta Kuta, Dasha Kuta & Mangal Dosha)

```typescript
import { calculateAshtaKuta, calculateDashaKuta, PoruthamMatch, checkMangalDosha } from '@node-jhora/match';

// North Indian — Ashta Kuta (36 points max)
const north = calculateAshtaKuta(boyStar, girlStar, boySign, girlSign);
console.log(`Score: ${north.totalScore}/36 — ${north.isCompatible ? 'Compatible' : 'Incompatible'}`);

// South Indian — Dasha Kuta (10 Poruthams)
const south = calculateDashaKuta(boyStar, girlStar, boySign, girlSign);

// Mangal Dosha
const dosha = checkMangalDosha(boyChart, girlChart);
console.log(`Status: ${dosha.matchStatus}`); // 'None' | 'Present' | 'Cancel'
```

### 4. Event Detection (Ingress, Stations & Custom)

```typescript
import { TransitScanner } from '@node-jhora/events';

const scanner = new TransitScanner();

// Find when Jupiter enters Aries
const ingress = await scanner.findIngress(5, 0, startDate);

// Find next retrograde station for Saturn
const station = await scanner.findStationaryPoint(6, startDate);

// Generic event solver (binary search)
const event = await scanner.findEventTime(start, end, (date) => someCondition(date));
```

### 5. PDF Reports

```typescript
import { generateFullReport } from '@node-jhora/reporting';

const pdfBuffer = await generateFullReport(chartData, {
    subjectName: 'John Doe',
    birthDate: '2000-01-01',
    birthPlace: 'Chennai, India',
    chartStyle: 'North' // or 'South'
});
```

### 6. REST API Server

```bash
# Start the API server
cd packages/api
npm run start
# → http://localhost:3000
```

```bash
# Example request
curl -X POST http://localhost:3000/v1/chart \
  -H "Content-Type: application/json" \
  -d '{"datetime": "2000-01-01T12:00:00Z", "latitude": 13.08, "longitude": 80.27}'
```

**Available endpoints:** `/v1/chart`, `/v1/chart/vargas`, `/v1/panchanga`, `/v1/dasha`, `/v1/shadbala`, `/v1/kp`, `/v1/match` ([Full API Docs](./docs/API.md))

## 🛠️ Contributing

We welcome contributions! The project uses an NPM workspaces monorepo structure.

```bash
# Install all dependencies
npm install

# Build all packages (incremental via TypeScript Project References)
npm run build

# Run all tests
npm test

# Run tests for a specific package
npx jest --config packages/core/jest.config.js

# Lint TypeScript source files
npm run lint
```

## 📄 License

**Source Available — Commercial License Required**.
Copyright (c) 2026 Harieshwar Jagan Abirami. All Rights Reserved.

*   **Public Access**: Source code is available for inspection and education.
*   **Restricted Use**: Usage, distribution, and **derivative works** are strictly prohibited without a Commercial License.
*   Contact the owner to negotiate licensing terms. See [LICENSE](LICENSE).
