# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# MISSION: Project "Node-Jhora" Backend Refactor & API Standardization

You are an expert Full Stack Node.js Backend Engineer and a specialist in Vedic Astrology (Jyotish) algorithmic calculations.

Your objective is to refactor the `node-jhora` monorepo to achieve 100% mathematical parity with the `pyjhora` library, establish a rigorous "Golden Standard" test suite, and expose the logic via an industry-grade API.

## STRICT CONSTRAINTS & RULES

1. **Absolute Precision:** Jyotish calculations are highly sensitive. NEVER use native JavaScript `Number` for floating-point planetary longitudes, Ayanamsa, or divisional math. You MUST use a high-precision library like `decimal.js` or `bignumber.js` for all core calculations.
2. **Ephemeris Parity:** The engine uses JPL DE440s (public domain, AGPL-free). Ensure planetary positions match JHora reference charts. Ayanamsa values in `packages/core/src/engine/ayanamsa.ts` are calibrated for DE440; do not copy SE/pyswisseph raw values without applying the +0.088827° DE440 offset.
3. **No Frontend:** I do not care about the frontend. You are authorized to completely delete, deprecate, or ignore any frontend code (React, Vue, etc.) in this monorepo. Focus 100% on the backend engine.
4. **Agentic Autonomy:** Run tests frequently. If a test fails, analyze the delta between the Node output and the Python expectation, correct the math, and re-run until it passes. Do not stop until the suite is green.

## EXECUTION PHASES (Execute sequentially)

### Phase 1: Test Suite Porting (The Golden Standard)

- Analyze the `pyjhora` repository (specifically the `pvr_tests` or equivalent test data/fixtures).
- Scaffold a robust testing environment in `node-jhora` using `Vitest` or `Jest`.
- Port all Python test cases into Node.js. These tests must validate ephemeris outputs, planetary longitudes, D-charts (Vargas), and Dashas.
- Run the tests. (They will fail initially. This establishes our baseline).

### Phase 2: Core Engine Refactor

- Refactor the core calculation modules in `node-jhora` to match the architectural flow of `pyjhora`.
- Replace all floating-point math with high-precision decimal libraries.
- Iterate on the math and ephemeris configurations until the Node.js test suite passes 100% of the Golden Standard tests.

### Phase 3: Industry-Grade API Layer

- Once the tests pass, design a modern, robust REST or GraphQL API layer for the backend (using Fastify or Express).
- Implement strict input validation (e.g., using `Zod`) for all astrology endpoints (Date, Time, Latitude, Longitude, Timezone).
- Ensure the API is stateless, highly performant, and includes basic structured logging (e.g., `Pino`).

### Phase 4: Clean Up

- Delete any legacy frontend code or dead calculation files that are no longer used in the new architecture.

Please acknowledge these instructions. Begin Phase 1 by searching for the test fixtures and setting up the Node.js test runner. Show me your plan for porting the tests before writing the code.

# CRITICAL DIRECTIVES: node-jhora vs pyjhora

- **The Goal:** We are refactoring `node-jhora` to achieve 100% calculation parity with the Python `pyjhora` library.
- **Mathematical Precision:** NEVER use native JavaScript floating-point math for planetary longitudes, Ayanamsa, or divisional charts. ALWAYS use `Decimal.js` (or our designated math library) to prevent precision loss and rounding errors.
- **Testing:** All logic changes must be verified against the `pyjhora` test suite standard.

## Commands

All commands run from `node-jhora/` (monorepo root) unless noted.

```bash
# Install dependencies
npm install

# Build all packages (incremental via TypeScript project references)
npm run build

# Build and force rebuild from scratch
npx tsc -b --clean && npm run build

# Run all tests across all packages
npm test

# Run tests for a single package
npx jest --config packages/core/jest.config.js
npx jest --config packages/analytics/jest.config.js
npx jest --config packages/prediction/jest.config.js
npx jest --config packages/match/jest.config.js

# Run a single test file
npx jest --config packages/core/jest.config.js packages/core/tests/ephemeris.test.ts

# Lint TypeScript source files
npm run lint

# Portal app (from apps/portal/)
cd apps/portal && npm install
npm run dev      # Vite dev server
npm run build    # Production build (tsc + vite build)
npm run preview  # Preview production build
```

## Architecture

This is a **tiered NPM workspaces monorepo** (`node-jhora/`) implementing a Vedic astrology (Jyotish) engine. All packages are **pure ESM** (`"type": "module"`).

### Package Dependency Graph

```
@node-jhora/core          ← Foundation (no internal deps)
@node-jhora/analytics     ← depends on core
@node-jhora/match         ← depends on core
@node-jhora/prediction    ← depends on core + analytics
@node-jhora/events        ← depends on core
@node-jhora/reporting     ← depends on core + analytics + prediction (PDF via pdfkit)
@node-jhora/ui-react      ← depends on core (React SVG chart components)
apps/portal               ← depends on core + match + ui-react (React + Vite demo app)
```

### Core Package (`packages/core`)

The foundation layer. Key sub-directories:

- `engine/` — JPL DE440s ephemeris engine (`EphemerisEngine` singleton, must call `await eph.initialize()` before use). Pure TypeScript SPK reader — no WASM, no AGPL. Data file `de440s.bsp` is loaded from `@node-jhora/ephe` or the `NODE_JHORA_EPHE_PATH` env var.
- `vedic/` — Panchanga (Tithi/Nakshatra/Yoga/Karana/Vara), 16 divisional charts (Vargas D1–D60), house systems, Upagrahas, Special Lagnas
- `kp/` — KP system sublord and ruling planet calculations
- `core/` — Angular math utilities, planetary relationships
- `stream/` — Real-time `PlanetaryStream` for live data
- `browser.ts` — Browser compatibility shim for WASM

### Analytics Package (`packages/analytics`)

Depth/strength layer:

- `shadbala.ts` / `shadbala_time.ts` — 6-fold planetary strength (Sthana, Dig, Kaala, Chesta, Naisargika, Drig Bala)
- `ashtakavarga.ts` — BAV/SAV 8-fold grid
- `yogas/` — Rule-based Yoga detection engine (JSON-compatible `YogaDefinition` interface; custom Yogas can be added without changing engine code)
- `aspects.ts` — Aspect strength calculations

### Prediction Package (`packages/prediction`)

Time-based predictive logic:

- `dasha.ts` — Vimshottari Dasha (120-year, 5 recursive levels: Maha → Antar → Pratyantar → Sookshma → Prana)
- `yogini.ts` — Yogini Dasha (8-year cycles)
- `narayana.ts` — Narayana/Rashi-based Dasha
- `transits.ts` — Planet ingress/aspect scanning using Newton-Raphson interpolation
- `jaimini/` — Chara Karakas (7-karaka system), Arudha Padas, Chara Dasha

### Build System

TypeScript Project References with `composite: true` enables incremental builds. Each package `tsconfig.json` explicitly declares its `references`. Running `tsc -b` at root builds only what changed in dependency order. Package outputs go to each package's `dist/` directory.

### Testing

Jest 30 with `ts-jest` ESM preset. The `moduleNameMapper` strips `.js` extensions for ESM resolution. Tests live in `packages/<name>/tests/` as `*.test.ts` or `*.spec.ts`.

### Engine Initialization (Required)

The DE440 ephemeris engine reads `de440s.bsp` from disk and must be initialized before any planetary calculations:

```typescript
const eph = EphemerisEngine.getInstance();
await eph.initialize(); // Required — loads de440s.bsp
```

The engine resolves `de440s.bsp` in this order:
1. `NODE_JHORA_EPHE_PATH` environment variable
2. `@node-jhora/ephe` npm package (auto-downloaded from JPL on `npm install`)
3. Dev fallback: `de440s.bsp` next to the `packages/` directory

**No WASM, no Swiss Ephemeris, no AGPL.** The engine is pure TypeScript + JPL data (U.S. Government public domain).

### ESM Import Convention

All internal imports use `.js` extensions even for TypeScript source files (NodeNext resolution). Example: `import { normalize } from './math.js'` (not `./math.ts`).
