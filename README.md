# Node-Jhora: Professional Vedic Astrology SDK

Node-Jhora is a Vedic astrology (Jyotish) engine for Node.js and TypeScript. It is a pnpm-workspaces monorepo (`pnpm-workspace.yaml` covers `packages/*` and `apps/*`). Libraries live in `packages/`. Applications belong in `apps/` (none are checked in; a React UI is planned there).

## Features

- **Ephemeris**: Pure TypeScript reader for the JPL DE440s SPK kernel (`de440s.bsp`), loaded by `@node-jhora/ephe`. The downloader and the engine record that kernel's coverage as **1849-12-26 through 2150-01-22**. A time that falls in no Type-2 segment throws from `SpkFile.getState`. There is no Swiss Ephemeris dependency and no WASM binary.
- **Ayanamsa**: The default is **True Chitrapaksha** (mode `27`, convenience name `'TrueChitra'`, API key `'true_chitra'`), derived from Spica at 180°. `AYANAMSA_MODELS` also implements True Pushya (29), True Revati (30), True Mula (35), Fagan/Bradley (0), Lahiri (1, label `Lahiri (ICRC)`), Raman (3), Krishnamurti/KP (5), Yukteshwar (7), JN Bhasin (8), and J2000 (18). `AYANAMSA.LAHIRI_ICRC` is mode `2` and has no registry entry; `getAyanamsa` uses mode 27 for any mode that is missing from `AYANAMSA_MODELS`.
- **Vedic core**: Panchanga (Tithi, Nakshatra, Yoga, Karana, Vara) and the 16 divisional charts D1, D2, D3, D4, D7, D9, D10, D12, D16, D20, D24, D27, D30, D40, D45, and D60.
- **House systems**: Whole Sign (the `houseSystem` default) and Equal (`wholeSignCusps` / `equalHouseCusps`). The `HouseSystem` type also names `Placidus` and `Porphyry`; `EphemerisEngine.getHouses` uses the Whole Sign cusp formula for every method other than `'E'`.
- **Special lagnas**: Pranapada, Indu, Shree, Hora, Ghati, Bhava, and Varnada (exported from `@node-jhora/core`).
- **Upagrahas**: `calculateTimeUpagrahas` and `calculateDhumadiUpagrahas`.
- **Jaimini**: `JaiminiCore.calculateCharaKarakas` and `JaiminiCore.calculateArudha`, plus `JaiminiDashas.calculateCharaDasha`, in `@node-jhora/prediction`.
- **KP**: `KPSubLord` and `KPRuling` in core; `KPEngine` in analytics.
- **Yogas**: `YogaEngine.findYogas` evaluates a `YogaDef` list. The shipped `YOGA_LIBRARY` contains 7 yogas.
- **Predictive**: `generateVimshottari`, `YoginiDasha`, and `NarayanaDasha`.
- **Analytics**: `calculateShadbala` and Ashtakavarga BAV/SAV (`Ashtakavarga.calculateBAV`, `Ashtakavarga.calculateSAV`).
- **Matchmaking**: `calculateAshtaKuta`, `calculateDashaKuta`, and `checkMangalDosha`.
- **REST API**: Fastify server with Zod request schemas (`@node-jhora/api`).
- **Events**: `TransitScanner` for ingresses, stations, and a generic time solver.
- **PDF reports**: `generateFullReport` (PDFKit) in `@node-jhora/reporting`.
- **Decimal.js**: Vargas, panchanga, KP sub-lords, and `packages/core/src/core/precise.ts` use `decimal.js`. SPK state and the coordinate chain in `ephemeris.ts` use ordinary floating-point numbers.

Astrometric comparisons against JPL Horizons are written up in [docs/ACCURACY.md](./docs/ACCURACY.md). The engine file header records ≤ 0.28″ on the 1900, 1970, 1998, and 2024 sample epochs.

## Packages

| Package                                           | Description                                                                             |
| :------------------------------------------------ | :-------------------------------------------------------------------------------------- |
| [`@node-jhora/core`](./packages/core)             | DE440s ephemeris, ayanamsa, panchanga, vargas, KP, houses. ([Docs](./docs/CORE.md))     |
| [`@node-jhora/ephe`](./packages/ephe)             | JPL `de440s.bsp` kernel (31 MB, in the tarball). Data only; calculation stays in core.  |
| [`@node-jhora/analytics`](./packages/analytics)   | Shadbala, Ashtakavarga, yoga engine, KP engine. ([Docs](./docs/ANALYTICS.md))           |
| [`@node-jhora/prediction`](./packages/prediction) | Vimshottari, Yogini, Narayana, transits, Jaimini. ([Docs](./docs/PREDICTION.md))        |
| [`@node-jhora/match`](./packages/match)           | Ashta Kuta, Dasha Kuta (Porutham), Mangal Dosha. ([Docs](./docs/MATCHMAKING.md))        |
| [`@node-jhora/events`](./packages/events)         | `TransitScanner`. ([Docs](./docs/EVENTS.md))                                            |
| [`@node-jhora/reporting`](./packages/reporting)   | PDF reports. ([Docs](./docs/REPORTING.md))                                              |
| [`@node-jhora/api`](./packages/api)               | Fastify + Zod HTTP API. ([Docs](./docs/API.md))                                         |
| [`@node-jhora/atlas`](./packages/atlas)           | Offline GeoNames city gazetteer (data © GeoNames, CC-BY 4.0). ([Docs](./docs/ATLAS.md)) |
| [`@node-jhora/testkit`](./packages/testkit)       | Private. Golden-case schema and fixture converters. ([Docs](./docs/GOLDENS.md))         |

`pnpm build` (`tsc -b`) compiles every TypeScript workspace through the root `tsconfig.json` `references`: `core`, `analytics`, `prediction`, `match`, `api`, `events`, `reporting`, `testkit`, `format`, `engine`, `atlas`, and `bench`. `ephe` is a data package with no `tsconfig.json`.

## Documentation

The [documentation site](./apps/docs) (Astro Starlight) is built with `pnpm run docs:build` from the repository root. Guides are synced from this README and `docs/` at build time; the API reference is generated with TypeDoc.

- **[Architecture](./docs/ARCHITECTURE.md)** — workspaces, package boundaries, build.
- **[Accuracy](./docs/ACCURACY.md)** — Horizons and JHora-export comparisons recorded in-repo.
- **[Mathematical notes](./docs/MATH.md)**
- **[Core](./docs/CORE.md)** — `EphemerisEngine`, `NodeJHora`, panchanga, lagnas, upagrahas.
- **[Analytics](./docs/ANALYTICS.md)** — Shadbala, Ashtakavarga, yogas, KP engine.
- **[Prediction](./docs/PREDICTION.md)** — dashas, transits, Jaimini.
- **[Matchmaking](./docs/MATCHMAKING.md)** — Ashta Kuta, Dasha Kuta, Mangal Dosha.
- **[REST API](./docs/API.md)** — Fastify routes and Zod schemas.
- **[Events](./docs/EVENTS.md)** — `TransitScanner`.
- **[PDF reporting](./docs/REPORTING.md)**
- **[Atlas](./docs/ATLAS.md)** — offline GeoNames gazetteer and attribution.
- **[Golden cases](./docs/GOLDENS.md)** — schema for accuracy fixtures.
- **[Market notes](./docs/MARKET_POSITION.md)**

## Installation

```bash
npm install @node-jhora/core @node-jhora/ephe
```

`@node-jhora/core` declares `@node-jhora/ephe` as an optional peer dependency. Install it to get `de440s.bsp` inside `node_modules` with no network access at runtime. Without it, core downloads the same bytes from JPL into a user cache on first use and checks the pinned SHA-256; `npx node-jhora-ephe prefetch de440s` does that ahead of time. No package runs an install script. Override the path with `NODE_JHORA_EPHE_PATH`. See [ADR 0006](./docs/decisions/0006-npm-packaging-and-ephemeris-data-distribution.md).

Other packages in this workspace: `@node-jhora/analytics`, `@node-jhora/prediction`, `@node-jhora/match`, `@node-jhora/events`, `@node-jhora/reporting`, `@node-jhora/api`.

Contributors use pnpm. See [CONTRIBUTING.md](./CONTRIBUTING.md). The `npm install` lines above are for a published package.

This repository is pure ESM (`"type": "module"`).

## Quick start

`NodeJHora.calculate` defaults the ayanamsa name to `'TrueChitra'` (`AYANAMSA.TRUE_CITRA`, mode 27). Library defaults in `DEFAULT_CONFIG` are the same mode, `positionMode: 'geometric'`, `nodeType: 'true'`, and `houseSystem: 'WholeSign'`.

```typescript
import { NodeJHora } from '@node-jhora/core';

const chart = await NodeJHora.calculate(
    new Date('2000-01-01T12:00:00Z'),
    { latitude: 13.08, longitude: 80.27 }, // Chennai
    'TrueChitra',
);

console.log('Ascendant:', chart.ascendant);
console.log('Sun:', chart.planets.find((p) => p.id === 0)?.longitude);
console.log('Moon nakshatra:', chart.panchanga.nakshatra);
```

Other names accepted by that argument: `'TruePushya'`, `'TrueRevati'`, `'TrueMula'`, `'Lahiri'`, `'LahiriICRC'`, `'Raman'`, `'KP'`, `'Yukteshwar'`, `'FaganBradley'`. `'LahiriICRC'` maps to mode 2, which is not in `AYANAMSA_MODELS` (see above).

```typescript
import { NodeJHora } from '@node-jhora/core';
import { DateTime } from 'luxon';

const jhora = new NodeJHora({ latitude: 13.08, longitude: 80.27 });
await jhora.init();

const date = DateTime.fromISO('2000-01-01T12:00:00Z');
const chart = jhora.getChart(date);
const panchanga = jhora.getPanchanga(date);
```

```typescript
import { EphemerisEngine, calculateHouseCusps, calculatePanchanga } from '@node-jhora/core';
import { DateTime } from 'luxon';

const engine = EphemerisEngine.getInstance();
await engine.initialize();

const dt = DateTime.now();
const location = { latitude: 13.08, longitude: 80.27 };
const planets = engine.getPlanets(dt, location); // ayanamsa: instance default, mode 27
const houses = calculateHouseCusps(dt, location.latitude, location.longitude, 'WholeSign', engine);
```

`de440s.bsp` is resolved in this order: `NODE_JHORA_EPHE_PATH`, then `@node-jhora/ephe`, then the monorepo copy, then the user cache, then a SHA-256-verified download from JPL into that cache (skipped when `NODE_JHORA_OFFLINE=1`).

## Modules

### Analytics

```typescript
import { calculateShadbala, Ashtakavarga, YogaEngine, YOGA_LIBRARY } from '@node-jhora/analytics';

const strength = calculateShadbala({
    planet,
    allPlanets,
    houses,
    sun,
    moon,
    timeDetails: { sunrise, sunset, birthHour },
    vargaPositions,
});

const av = Ashtakavarga.calculateSAV(planets);
const bavSun = Ashtakavarga.calculateBAV(planets, 0);

const yogas = YogaEngine.findYogas(chartData, YOGA_LIBRARY);
```

### Prediction

```typescript
import {
    generateVimshottari,
    YoginiDasha,
    NarayanaDasha,
    JaiminiCore,
    JaiminiDashas,
} from '@node-jhora/prediction';

const dashas = generateVimshottari(birthDate, moonLongitude, 5);
const yogini = YoginiDasha.calculate(moonLongitude, birthDate, 80);
const karakas = JaiminiCore.calculateCharaKarakas(planets);
const charaDasha = JaiminiDashas.calculateCharaDasha(lagnaSign, planets);
```

### Matchmaking

```typescript
import { calculateAshtaKuta, calculateDashaKuta, checkMangalDosha } from '@node-jhora/match';

const north = calculateAshtaKuta(boyStar, girlStar, boySign, girlSign);
const south = calculateDashaKuta(boyStar, girlStar, boySign, girlSign);
const dosha = checkMangalDosha(boyChart, girlChart);
```

### Events

```typescript
import { TransitScanner } from '@node-jhora/events';

const scanner = new TransitScanner();
const ingress = await scanner.findIngress(5, 0, startDate);
const station = await scanner.findStationaryPoint(6, startDate);
const event = await scanner.findEventTime(start, end, (date) => someCondition(date));
```

### PDF reports

```typescript
import { generateFullReport } from '@node-jhora/reporting';

const pdfBuffer = await generateFullReport(chartData, {
    subjectName: 'Example',
    birthDate: '2000-01-01',
    birthPlace: 'Chennai, India',
    chartStyle: 'North', // or 'South'
});
```

### REST API

```bash
pnpm --filter @node-jhora/api start
# listens on 0.0.0.0:3000 unless HOST / PORT are set
```

```bash
curl -X POST http://localhost:3000/v1/chart \
  -H "Content-Type: application/json" \
  -d '{"date":"2000-01-01","time":"12:00:00","latitude":13.08,"longitude":80.27,"timezone":"Asia/Kolkata"}'
```

Routes registered in `packages/api/src/server.ts`:

| Method | Path                   |
| :----- | :--------------------- |
| GET    | `/health`              |
| POST   | `/v1/chart`            |
| POST   | `/v1/chart/vargas`     |
| POST   | `/v1/panchanga`        |
| POST   | `/v1/dasha`            |
| POST   | `/v1/transits`         |
| POST   | `/v1/reading`          |
| POST   | `/v1/shadbala`         |
| POST   | `/v1/kp/significators` |
| POST   | `/v1/match`            |

The chart body schema is `BirthInputSchema` in `packages/api/src/schemas/birth-input.ts` (date, time, and either a city or latitude/longitude/timezone). Omitted `ayanamsa` defaults to `true_chitra`. See [docs/API.md](./docs/API.md) for the field list. That page still shows an older request shape in places; the schema file is the source of truth.

## Contributing

Branch names, pull request titles, and merge rules are in [CONTRIBUTING.md](./CONTRIBUTING.md). The clean-room policy is in [docs/CLEAN_ROOM.md](./docs/CLEAN_ROOM.md).

Commands are from the monorepo root.

```bash
corepack enable
corepack prepare --activate
pnpm install --frozen-lockfile

# tsc -b over the root tsconfig references:
# core, analytics, prediction, match, api, events, reporting, testkit.
pnpm build

# Jest 30: one project per packages/*/jest.config.js (ephe has none) plus
# tools/jest.config.js, then node --test for the clean-room guard.
pnpm test

pnpm exec jest --config packages/core/jest.config.js

# Relative links in tracked and untracked Markdown (no network).
pnpm run check:links

# Forbidden help/image/binary files, stray .jhd charts, decompiler markers (docs/CLEAN_ROOM.md).
pnpm run check:clean-room

pnpm run validate-github-templates
```

`pnpm run lint` is `eslint packages/**/src --ext .ts`. ESLint is not listed in the root `devDependencies`, so that script cannot run until ESLint is installed.

## License

**Source available — commercial license required.**
Copyright (c) 2026 Harieshwar Jagan Abirami. All Rights Reserved.

- **Public access**: source is available for inspection and education.
- **Restricted use**: usage, distribution, and derivative works require a commercial license.
- See [LICENSE](LICENSE).
- `@node-jhora/atlas` place data is derived from [GeoNames](https://www.geonames.org/) and licensed under [CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/); see [packages/atlas/ATTRIBUTION.md](./packages/atlas/ATTRIBUTION.md).
