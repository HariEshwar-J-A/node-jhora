
# Node-Jhora: Professional Vedic Astrology Engine

Node-Jhora is a high-precision, performance-oriented **Vedic Astrology (Jyotish)** engine for Node.js and TypeScript. It is built for developers building professional-grade astrology software, leveraging direct WASM bindings to the Swiss Ephemeris for speed and accuracy.

## Features

*   **Precision Astronomy**: Uses Swiss Ephemeris (WASM) for planetary positions (0.0001" accuracy).
*   **Vedic Core**: Ayanamsa support (Lahiri, Raman, Krishnamurti, etc.), Panchanga (Tithi, Nakshatra, Yoga, Karana, Vara), and all 16 Divisional Charts (Vargas).
*   **House Systems**: Placidus, Whole Sign, Equal House, Porphyry, and more. Bhava Madhya and Sandhi calculations.
*   **Jaimini System**: 7 Chara Karakas (Degree-based), Rashi Drishti (Aspects), Arudha Padas (with exceptions), and Chara Dasha.
*   **KP System**: Sign, Star, Sub, and Sub-Sub Lord calculations with Ruling Planets.
*   **Yoga Engine**: Extensible engine to detect planetary combinations (Pancha Mahapurusha, Gaja Kesari, Parivartana, etc.).
*   **Predictive**: Vimshottari Dasha (Mahadasha, Antardasha, Pratyantardasha) up to 5 levels.
*   **Analytics**: Complete Shadbala (6-fold strength) calculation including Ishta/Kashta Phala.
*   **Real-time Streams**: Observable streams for planetary updates (Prashna/Ticker modes).

## Installation

```bash
npm install node-jhora
```

**Note**: This package is pure ESM. Ensure your `package.json` has `"type": "module"`.

## Quick Start

```typescript
import { NodeJHora, DateTime } from 'node-jhora';

async function main() {
    // 1. Initialize with Location (Latitude, Longitude)
    const client = new NodeJHora({ latitude: 13.0827, longitude: 80.2707 }); // Chennai
    await client.init();

    // 2. Calculate Chart for a Date
    const birthTime = DateTime.fromISO('1990-05-25T14:30:00');
    const chart = client.getChart(birthTime);

    console.log("Sun Longitude:", chart.planets[0].longitude);
    console.log("Ascendant:", chart.houses.ascendant);
}

main();
```

## Modules Guide

### 1. Ephemeris & Charts
Core planetary calculations using the `EphemerisEngine` or the `NodeJHora` facade.

```typescript
import { EphemerisEngine } from 'node-jhora';
const eph = new EphemerisEngine();
await eph.initialize();

// Get raw positions
const planets = eph.getPlanets(date, { lat, lon }, 1 /* Lahiri */);
```

### 2. Vedic Calendars (Panchanga)
Calculate the five limbs of time.

```typescript
import { calculatePanchanga } from 'node-jhora';

const panchanga = calculatePanchanga(sunLon, moonLon, dateObj);
console.log(`Tithi: ${panchanga.tithi.name}, Nakshatra: ${panchanga.nakshatra.name}`);
```

### 3. Jaimini System
Calculate Chara Karakas, Arudhas, and Chara Dasha.

```typescript
import { JaiminiCore, JaiminiDashas } from 'node-jhora';

// 1. Chara Karakas (AK, AmK, BK, MK, PK, GK, DK)
const karakas = JaiminiCore.calculateCharaKarakas(planets);
const atmaKaraka = karakas.find(k => k.karaka === 'AK');

// 2. Arudha Lagna (AL)
const alSignIndex = JaiminiCore.calculateArudha(1, lagnaSign, lagnaLordSign);

// 3. Chara Dasha
const dashas = JaiminiDashas.calculateCharaDasha(lagnaSign, planets);
```

### 4. KP System (Krishnamurti Paddhati)
Calculate Sub-Lords and Ruling Planets.

```typescript
import { KPSubLord, KPRuling } from 'node-jhora';

// 1. Get Sign/Star/Sub/Sub-Sub Lord for any longitude
const sig = KPSubLord.calculateKPSignificators(planetLon);
console.log(`Sub Lord: ${sig.subLord}`);

// 2. Ruling Planets (RP)
const rp = KPRuling.calculateRulingPlanets(ascLon, moonLon, dayLordId);
```

### 5. Yoga Engine
Detect powerful planetary combinations.

```typescript
import { YogaEngine, YOGA_LIBRARY } from 'node-jhora';

const engine = new YogaEngine();
// Register standard yogas
YOGA_LIBRARY.forEach(y => engine.registerYoga(y));

// Evaluate
const results = engine.evaluate(chartData);
results.filter(r => r.present).forEach(r => console.log(`Yoga Found: ${r.yoga.name}`));
```

### 6. Predictive (Dashas)
Vimshottari Dasha calculation.

```typescript
import { generateVimshottari } from 'node-jhora';

const dashas = generateVimshottari(birthDate, moonLongitude, 120 /* years */);
// Traverse the tree: dashas[0].subPeriods[0]...
```

### 7. Divisional Charts (Vargas)
Calculate positions in D9 (Navamsa), D10 (Dasamsa), etc.

```typescript
import { calculateVarga } from 'node-jhora';

const navamsa = calculateVarga(planetLon, 9);
console.log(`Planet in D9: Sign ${navamsa.sign}`);
```

### 8. Ashtakavarga & Transits
Calculate BAV/SAV scores and detect planetary movements.

```typescript
import { Ashtakavarga, TransitEngine } from 'node-jhora';

// 1. Ashtakavarga
const result = Ashtakavarga.calculate(chart.planets, chart.houses.ascendant.sign);
console.log("Sarvashtakavarga (SAV):", result.sav); // [28, 30, ...]

// 2. Transits (Event Scanner)
const scanner = new TransitEngine();
const events = await scanner.findTransits(
    0, // Sun
    DateTime.now(),
    DateTime.now().plus({ months: 1 })
);    
events.forEach(e => console.log(`${e.type} Change to ${e.newValue} at ${e.time}`));
```

## Contributing

We welcome contributions! Please verify your changes with:
```bash
npm test
```
Clean room implementations (like Jaimini and KP) have dedicated test suites in `tests/jaimini` and `tests/kp`.

## License

**Source Available - Commercial License Required**.
Copyright (c) 2026 Harieshwar Jagan Abirami. All Rights Reserved.

*   **Public Access**: Source code is available for inspection and education.
*   **Restricted Use**: Usage, distribution, and **derivative works** are strictly prohibited without a Commercial License.
*   **Royalties**: A commercial license with royalty payments is required for any use or adaptation of this software.
*   Contact the owner to negotiate licensing terms.
*   **Contributors**: PRs are welcome! Contributors assign rights to the owner but may be eligible for favorable royalty terms. See [LICENSE](LICENSE).
