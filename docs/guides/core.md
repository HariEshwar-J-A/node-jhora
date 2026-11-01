# Package: `@node-jhora/core`

The `@node-jhora/core` package is the heart of the engine, providing high-precision astronomical data, fundamental Vedic math, and an ergonomic facade for common operations.

---

## 🎯 NodeJHora Facade

The `NodeJHora` class is the recommended entry point for most use cases. It offers both a static one-shot API and a reusable instance API.

### Static API (Simplest)

Calculate a complete birth chart in a single call — engine initialization is handled automatically:

```typescript
import { NodeJHora } from '@node-jhora/core';

const chart = await NodeJHora.calculate(
    new Date('2000-01-01T12:00:00Z'),
    { latitude: 13.08, longitude: 80.27 },
    'Lahiri', // 'Lahiri' | 'Raman' | 'KP'
    { topocentric: true, nodeType: 'mean' },
);

// Returns: { planets, houses, panchanga, ascendant, ayanamsa }
console.log('Ascendant:', chart.ascendant);
console.log('Tithi:', chart.panchanga.tithi);
```

### Instance API (Full Control)

For repeated calculations at the same location, create a persistent instance:

```typescript
import { NodeJHora } from '@node-jhora/core';
import { DateTime } from 'luxon';

const jhora = new NodeJHora(
    { latitude: 13.08, longitude: 80.27 },
    { ayanamsaOrder: 1, topocentric: true, nodeType: 'mean' },
);
await jhora.init();

const date = DateTime.fromISO('2000-01-01T12:00:00Z');
const planets = jhora.getPlanets(date); // PlanetPosition[]
const houses = jhora.getHouses(date, 'Placidus'); // HouseData
const chart = jhora.getChart(date); // { planets, houses }
const panchanga = jhora.getPanchanga(date); // PanchangaResult
```

### Configuration (`NodeJHoraConfig`)

```typescript
interface NodeJHoraConfig {
    ayanamsaOrder?: number; // 1 = Lahiri (default), 3 = Raman, 5 = KP
    topocentric?: boolean; // Apply observer-surface parallax correction
    nodeType?: 'mean' | 'true'; // Rahu/Ketu node type
    ayanamsaOffset?: number; // Custom offset in degrees
}
```

---

## 🏛️ Ephemeris Engine

The low-level engine uses a **pure TypeScript JPL DE440s** SPK reader (`EphemerisEngine`). There is no WASM binary in `@node-jhora/core`.

### Initialization

Load the BSP kernel before any calculations (once per worker or isolate):

```typescript
import { EphemerisEngine } from '@node-jhora/core';

const eph = EphemerisEngine.getInstance(); // or `new EphemerisEngine()` per worker
await eph.initialize(); // Reads de440s.bsp (Node) or pass initialize({ kernel }) on edge
```

### Planetary Positions

Supports Sidereal (Vedic) calculations with optional **Topocentric Parallax** correction:

```typescript
const planets = eph.getPlanets(date, location, {
    ayanamsaOrder: 1,
    topocentric: true,
    nodeType: 'mean',
});
```

Each `PlanetPosition` contains:

| Field         | Type     | Description                  |
| :------------ | :------- | :--------------------------- |
| `id`          | `number` | Planet identifier            |
| `name`        | `string` | Planet name                  |
| `longitude`   | `number` | Sidereal longitude (degrees) |
| `latitude`    | `number` | Ecliptic latitude            |
| `distance`    | `number` | Distance from Earth (AU)     |
| `speed`       | `number` | Daily speed (deg/day)        |
| `declination` | `number` | Declination                  |

**Planet IDs:**

| ID  | Planet  |  ID  | Planet             |
| :-: | :------ | :--: | :----------------- |
| `0` | Sun     | `5`  | Jupiter            |
| `1` | Moon    | `6`  | Saturn             |
| `2` | Mercury | `10` | Rahu (Mean Node)   |
| `3` | Venus   | `99` | Ketu (Rahu + 180°) |
| `4` | Mars    |      |                    |

Use the `Body` enum (`Body.Rahu === 10`, `Body.Ketu === 99`) rather than literals. `EphemerisInterpolator.unpack()` uses the same ids.

### Ayanamsa Support

```typescript
import { AYANAMSA } from '@node-jhora/core';

// Registry modes (AYANAMSA_MODELS):
AYANAMSA.TRUE_CITRA; // 27 — True Chitrapaksha (default)
AYANAMSA.TRUE_PUSHYA; // 29
AYANAMSA.TRUE_MULA; // 35
AYANAMSA.LAHIRI; // 1
AYANAMSA.LAHIRI_ICRC; // 46
AYANAMSA.RAMAN; // 3
AYANAMSA.KRISHNAMURTI; // 5 — KP
AYANAMSA.FAGAN_BRADLEY; // 0
AYANAMSA.J2000; // 18
// SE constants 2, 7, 8, 28 exist on AYANAMSA.* but throw UnsupportedAyanamsaModeError.
```

### Additional Engine Methods

```typescript
eph.julday(date); // Julian Day Number (UT)
eph.getAyanamsa(julday); // Ayanamsa value in degrees
eph.getSiderealTime(julday); // Local Sidereal Time
eph.getEclipticObliquity(jd); // { eps, dpsi, deps }
eph.setAyanamsa(mode); // Switch Ayanamsa at runtime
eph.getHouses(jd, lat, lon, method, sidereal); // Equal (`E`) or whole-sign cusps from clean-room implementations
```

---

## 🏠 House Systems

Calculates house cusps using clean-room implementations (see ADR 0017):

```typescript
import { calculateHouseCusps } from '@node-jhora/core';

const houses = calculateHouseCusps(date, latitude, longitude, 'WholeSign', engine);
// Returns: { system, cusps (12), ascendant, mc, armc, vertex }
```

**Supported Methods:**

| Method        | Description                                                                         |
| :------------ | :---------------------------------------------------------------------------------- |
| `'WholeSign'` | Vedic standard — cusps snapped to 30° sign boundaries                               |
| `'Placidus'`  | Quadrant-based (clean-room; not all methods exposed on `EphemerisEngine.getHouses`) |
| `'Porphyry'`  | Trisection between angles                                                           |

### Bhava Sandhi

```typescript
import { calculateBhavaSandhi } from '@node-jhora/core'; // via houses module

const bhavas = calculateBhavaSandhi(cusps);
// Returns: { start, middle, end }[] for each of 12 houses
```

---

## Civil time resolver

Convert a **local wall-clock** birth time (IANA zone + latitude/longitude) to UTC with a
structured trace compatible with `.njh` `birth.tzResolution` (`@node-jhora/format` v2).

```typescript
import { resolveCivilTime, getTzdbVersion } from '@node-jhora/core';

const { resolvedUtc, julianDayUt, tzResolution, warnings } = resolveCivilTime({
    local: { year: 2000, month: 1, day: 1, hour: 12, minute: 0, second: 0 },
    timezone: 'Asia/Kolkata',
    latitude: 13.0827,
    longitude: 80.2707,
    policy: { ambiguous: 'earlier', gap: 'forward' },
});

console.log(resolvedUtc, getTzdbVersion(), tzResolution.steps);
```

Behaviour highlights:

- **IANA rules** come from the runtime's `Intl` tz database (read through Luxon); no
  offsets are hard-coded. `getTzdbVersion()` returns the tzdata release the runtime
  actually uses (`process.versions.tz` in Node, e.g. `2025b`) or `undefined` when the
  environment does not report it.
- **LMT** is exactly 4 minutes of time per degree of longitude (not rounded to whole
  minutes). It applies before the Gregorian reform (1582-10-15), outside the
  1800–2400 window where `Intl` zone history is used, for **India before 1900**
  (`Asia/Kolkata`, unless `preferIanaForIndia`), or when `forceLmt` is set.
- **Calendar**: the shared `time/historical.ts` implementation — proleptic Julian before
  1582-10-15, Gregorian from that date, astronomical year numbering (year `0` = 1 BC).
  Supported civil years: −9999 … 10000 (10 000 BC … 10 000 AD). `resolvedUtc` is ISO-8601,
  which is always proleptic Gregorian; use `julianDayUt` for exact pre-1582 instants.
- **Manual / war-time** offsets via `manualOffset`.
- **DST gap and overlap** policies: `gap: 'forward' | 'backward' | 'reject'` (default
  `forward`, e.g. 02:30 in a spring-forward gap becomes 03:30 DST) and
  `ambiguous: 'earlier' | 'later' | 'reject'` (default `earlier`). Both surface `warnings`
  and trace steps (`gap_skip`, `ambiguous_fold`).

---

## 🧭 Geocoder

A high-performance, stream-based city lookup tool using a local CSV database:

```typescript
import { Geocoder } from '@node-jhora/core';

const geo = new Geocoder();
const cities = await geo.search('Chennai');
// Returns: { name, latitude, longitude, timezone, country }
```

---

## 📐 Vedic Math & Fundamentals

### Angular Normalization

```typescript
import { normalize360 } from '@node-jhora/core';
normalize360(370); // 10
normalize360(-10); // 350
```

### Precision Math (Decimal.js)

For eliminating floating-point drift in Varga and Dasha calculations:

```typescript
import { D, toNum, normalize360D, NAKSHATRA_SPAN_D, DASHA_YEAR_DAYS } from '@node-jhora/core';

const lon = D(123.456789); // Create a Decimal
const norm = normalize360D(lon); // Normalize with full precision
const num = toNum(norm); // Convert back to number
```

### Panchanga (The Five Limbs)

Calculates Tithi, Nakshatra, Yoga, Karana, and Vara based on Sun and Moon positions:

```typescript
import { calculatePanchanga } from '@node-jhora/core';
const result = calculatePanchanga(sunLongitude, moonLongitude, date);
// Returns: { tithi, nakshatra, yoga, karana, vara, ... }
```

### Divisional Charts (Vargas)

All 16 standard Parashara Vargas using `Decimal.js` arithmetic:

```typescript
import { calculateVarga, calculateShashtyamsa, VargaDeities } from '@node-jhora/core';

const navamsa = calculateVarga(planetLongitude, 9); // D9
const d60 = calculateShashtyamsa(planetLongitude); // D60 with deity

// Supported divisions: 1, 2, 3, 4, 7, 9, 10, 12, 16, 20, 24, 27, 30, 40, 45, 60
```

Each `VargaPoint` returns:

```typescript
interface VargaPoint {
    longitude: number; // Position in the divisional chart
    sign: number; // 1-12
    degree: number; // Degree within sign
    deity?: string; // Deity name (D60 Shashtyamsa)
}
```

### Planetary Relationships

```typescript
import { getRelationship, PLANET_IDS, Relationship } from '@node-jhora/core';

const rel = getRelationship(PLANET_IDS.SUN, PLANET_IDS.MOON);
// Returns: Relationship enum (Friend, Enemy, Neutral)
```

---

## 🕉️ Special Lagnas

Seven Jaimini and Parashara special ascendant points:

```typescript
import {
    calculatePranapada, // Breath Lagna — extremely fast-moving
    calculateInduLagna, // Wealth Point — 9th lord rays
    calculateShreeLagna, // Prosperity Point
    calculateHoraLagna, // Hora Lagna — 1 sign/hour
    calculateGhatiLagna, // Ghati Lagna — 1 sign/ghati (24 min)
    calculateBhavaLagna, // Bhava Lagna — Sun-based mean lagna
    calculateVarnadaLagna, // Varnada Lagna — Lagna + HL combined
} from '@node-jhora/core';

// Pranapada — requires birth time, sunrise, and Sun longitude
const pp = calculatePranapada(birthTime, sunrise, sunLongitude);

// Indu Lagna — requires ascendant sign, Moon sign, and planet positions
const indu = calculateInduLagna(ascendantSign, moonSign, planets);

// Hora Lagna — requires birth time, sunrise, and base longitude
const hl = calculateHoraLagna(birthTime, sunrise, ascendantLongitude);

// Ghati Lagna — 1.25°/min speed
const gl = calculateGhatiLagna(birthTime, sunrise, sunLongitude);

// Bhava Lagna — 15°/hour speed
const bl = calculateBhavaLagna(birthTime, sunrise, sunLongitude);

// Varnada Lagna — combines Lagna and Hora Lagna with Odd/Even reversal
const vl = calculateVarnadaLagna(ascLong, horaLagnaLong, ascSign, hlSign);
```

---

## 🪐 Upagrahas (Sub-Planetary Points)

### Gulikadi Group (Time-Based)

Calculated from the 8-fold division of day/night based on weekday:

```typescript
import { calculateTimeUpagrahas } from '@node-jhora/core';

const gulikadi = calculateTimeUpagrahas(birthTime, sunrise, sunset, sunLong, moonLong, isDay);
// Returns: { kaala, paridhi, mrityu, ardhaprahara, yamakantaka, kodanda, mandi, gulika }
```

| Upagraha     | Planet Ruler | Timing                     |
| :----------- | :----------- | :------------------------- |
| Kaala        | Sun          | Start of segment           |
| Paridhi      | Moon         | Middle of segment          |
| Mrityu       | Mars         | Start of segment           |
| Ardhaprahara | Mercury      | Start of segment           |
| Yamakantaka  | Jupiter      | Start of segment           |
| Kodanda      | Venus        | Middle of segment          |
| Gulika       | Saturn       | Start of segment           |
| Mandi        | Saturn       | Middle of Gulika's segment |

### Dhumadi Group (Angular)

Fixed angular distances from the Sun:

```typescript
import { calculateDhumadiUpagrahas } from '@node-jhora/core';

const dhumadi = calculateDhumadiUpagrahas(sunLongitude);
// Returns: { dhuma, vyatipata, parivesha, indrachapa, upaketu }
```

| Upagraha   | Formula             |
| :--------- | :------------------ |
| Dhuma      | Sun + 133°20′       |
| Vyatipata  | 360° − Dhuma        |
| Parivesha  | Vyatipata + 180°    |
| Indrachapa | 360° − Parivesha    |
| Upaketu    | Indrachapa + 16°40′ |

---

## 🔮 KP System

### Sub-Lord Calculation

```typescript
import { KPSubLord } from '@node-jhora/core';

// Get KP significators (Sign Lord, Star Lord, Sub Lord, Sub-Sub Lord)
const kp = KPSubLord.getSignificators(planetLongitude);
```

> **Node ids in KP significators:** `KPSubLord` lord ids keep the legacy KP values **Rahu = 7, Ketu = 8** (API-stable; the `/v1/kp` response uses them). These differ intentionally from the ephemeris `Body` ids (Rahu = 10, Ketu = 99); don't compare them directly.

### Ruling Planets

```typescript
import { KPRuling } from '@node-jhora/core';

const ruling = KPRuling.calculate(ascendantLon, moonLon, date);
// Returns: RulingPlanetsResult
```

---

## 📡 Planetary Stream

For real-time applications (tickers, Prashna UI), use `PlanetaryStream` for periodic updates:

```typescript
const stream = client.createStream(1000); // 1 second interval

stream.on('reading', (update) => {
    console.log('Current Ascendant:', update.houses?.ascendant);
    console.log('Moon:', update.planets.find((p) => p.id === 1)?.longitude);
});

stream.start();
// ...later
stream.stop();
```
