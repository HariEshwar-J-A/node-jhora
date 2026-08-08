# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# MISSION: Project "Node-Jhora" Backend Refactor & API Standardization

You are an expert Full Stack Node.js Backend Engineer and a specialist in Vedic Astrology (Jyotish) algorithmic calculations.

Your objective is to refactor the `node-jhora` monorepo to achieve 100% mathematical parity with **Jagannatha Hora (JHora)** — the authoritative Java desktop software by P.V.R. Narasimha Rao — establish a rigorous "Golden Standard" test suite, and expose the logic via an industry-grade API.

> **NOTE on PyJHora:** JHora is the reference, not PyJHora. But the specific claim
> previously recorded here — that PyJHora's Moon is "~164° wrong due to a Moshier
> backend" — is **unverified and should not be repeated.** It rested entirely on
> `packages/core/tests/fixtures/pyjhora_golden.ts`, now deleted along with its
> 311 permanently-skipped bridge tests, because that fixture was demonstrably
> not a chart:
>
> - its ascendant is exactly 179.999° from the correct value — the signature of
>   the old node-jhora ascendant bug, so the number was produced by the broken
>   engine rather than read from PyJHora;
> - no single instant reproduces its planet set. The Sun implies the stated epoch
>   (+0.15 d), the Moon implies −179.7 d, Mercury −26 d, Venus +42 d, and Mars,
>   Jupiter and Saturn cannot be fitted within ±200 days at all.
>
> Nothing can be concluded about PyJHora's real accuracy from it. Benchmarking
> PyJHora requires running PyJHora and capturing its output.

## STRICT CONSTRAINTS & RULES

1. **Absolute Precision:** Jyotish calculations are highly sensitive. NEVER use native JavaScript `Number` for floating-point planetary longitudes, Ayanamsa, or divisional math. You MUST use a high-precision library like `decimal.js` or `bignumber.js` for all core calculations.
2. **Ephemeris Parity:** The engine uses JPL DE440s (public domain, AGPL-free).

   **Separate the two halves before debugging anything.** A sidereal longitude is
   `astrometry − ayanamsa`, and each half is independently wrong-able:

   - **Astrometry** is pinned against JPL Horizons in
     `packages/core/tests/fixtures/horizons_golden.ts` (sub-arcsecond, 1900–2024).
     Horizons is ground truth here and needs no JHora involvement.
   - **Ayanamsa** is pinned against JHora in `jhora_golden.ts`.

   Never absorb an astrometric error into an ayanamsa constant. A previous
   revision did exactly that — the J2000 ayanamsa values were back-fitted until
   one chart reproduced one expected Moon longitude, which hid 7–41″ of
   astrometric error at that date and re-emitted it at every other date.

   **Default ayanamsa is True Chitrapaksha (SE mode 27), Drik Siddhanta.** It is
   *derived* from Spica's computed position, not fitted, so it needs no
   calibration constant. The same holds for True Pushya/Revati/Mula. Prefer
   star-defined models; only epoch-anchored ones (Lahiri, Raman, KP) need
   constants, and each carries a `source` field recording its provenance.

3. **JHora conventions are choices, not accuracy.** Correct astronomy alone will
   not reproduce JHora. Four discrete settings must also match, and each was
   confirmed against a real JHora export (1998-12-06, Chennai):

   | Setting | Default | Evidence it is right |
   |---|---|---|
   | `AYANAMSA.TRUE_CITRA` (27) | ✔ | JHora prints `23-49-35.07`; engine 0.015″ away |
   | `positionMode: 'geometric'` | ✔ | JHora applies **no** light-time or aberration — removing them moves Venus 43.9″, Sun 20.8″, Saturn 7.4″, each onto JHora to 0.01″ |
   | `nodeType: 'true'` | ✔ | mean node misses Rahu by 0.97°; osculating node by 0.12″ |
   | `dasamsaScheme: 'jhora_5_8'` | ✔ | JHora's "D-10 (5-8)": even signs count backward from the 5th sign, degree reversed |

   Each is a single named constant in `ephemeris.ts` / `vargas.ts` and is
   overridable per call. If a chart disagrees with JHora, check these four before
   touching any math.
4. **No Frontend:** I do not care about the frontend. You are authorized to completely delete, deprecate, or ignore any frontend code (React, Vue, etc.) in this monorepo. Focus 100% on the backend engine.
5. **Agentic Autonomy:** Run tests frequently. If a test fails, analyze the delta between the Node output and the **JHora** expectation, correct the math, and re-run until it passes. Do not stop until the suite is green. PyJHora disagreements are NOT bugs unless JHora also disagrees.

## EXECUTION PHASES (Execute sequentially)

### Phase 1: Test Suite Porting (The Golden Standard) — DONE

Two independent reference fixtures now exist, and the distinction between them
is the whole point:

| Fixture | Pins | Source | Status |
|---|---|---|---|
| `horizons_golden.ts` | astrometry | JPL Horizons API | ≤ 0.28″, 1900–2024 |
| `jhora_golden.ts` | JHora conventions | real JHora export | D1 to 0.01″, D9 to 0.1″ |
| `reference_charts.ts` | regression only | this engine's own output | not ground truth |

**Rule for `reference_charts.ts`:** it is a snapshot, never evidence. Regenerate
it only after the other two suites are green, otherwise a regression simply gets
re-baselined. Every entry in `jhora_golden.ts` must carry the literal DMS string
JHora displays; if a value has no such string it does not belong there.

Each suite also asserts fixture-independent physical bounds (the Sun is never
retrograde, the ascendant leads the MC by 0°–180°, daily motion within orbital
limits). Those exist because the earlier fixture asserted a retrograde Sun and
the suite passed.

- PyJHora (`pvr_tests.py`) may be consulted for calculation *methods* (Varga formulas, Dasha logic) but its ephemeris values (especially Moon) should NOT be trusted as ground truth.

### Phase 2: Core Engine Refactor

- Refactor the core calculation modules in `node-jhora` to produce output matching JHora.
- Replace all floating-point math with high-precision decimal libraries.
- Iterate on the math and ephemeris configurations until the Node.js test suite passes 100% of the JHora Golden Standard tests.

### Phase 3: Industry-Grade API Layer

- Once the tests pass, design a modern, robust REST or GraphQL API layer for the backend (using Fastify or Express).
- Implement strict input validation (e.g., using `Zod`) for all astrology endpoints (Date, Time, Latitude, Longitude, Timezone).
- Ensure the API is stateless, highly performant, and includes basic structured logging (e.g., `Pino`).

### Phase 4: Clean Up

- Delete any legacy frontend code or dead calculation files that are no longer used in the new architecture.

Please acknowledge these instructions. Begin Phase 1 by searching for the test fixtures and setting up the Node.js test runner. Show me your plan for porting the tests before writing the code.

# CRITICAL DIRECTIVES: node-jhora vs JHora

- **The Goal:** We are refactoring `node-jhora` to achieve 100% calculation parity with **Jagannatha Hora (JHora)** — the authoritative Java software by P.V.R. Narasimha Rao. This is the industry standard for Vedic astrology.
- **Mathematical Precision:** NEVER use native JavaScript floating-point math for planetary longitudes, Ayanamsa, or divisional charts. ALWAYS use `Decimal.js` (or our designated math library) to prevent precision loss and rounding errors.
- **Testing:** All logic changes must be verified against **JHora output** for known reference charts. PyJHora's ephemeris values are NOT the standard — only its algorithmic formulas (Varga calculation methods, Dasha cycles, etc.) may be referenced.
- **Why not PyJHora?** It is a port, not the reference implementation; JHora is. See the note at the top of this file on why the repo's former PyJHora fixture could not support any accuracy claim, and why it was deleted rather than repaired.
- **Beware second-hand reference values.** JHora's Moon for the 1998-12-06 chart is `24 Ge 30' 39.61"` = 84.511003°, verified against a real export. An earlier revision of this file and its fixtures quoted 84.411° — 6′ low, because the numbers had been generated from an ayanamsa 6′ high rather than read from JHora. Always re-derive from an actual export.

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
