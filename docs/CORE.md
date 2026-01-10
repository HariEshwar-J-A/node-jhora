# Package: `@node-jhora/core`

The `@node-jhora/core` package is the heart of the engine, providing high-precision astronomical data and fundamental Vedic math.

## 🏛️ Ephemeris Engine

The engine uses **Swiss Ephemeris (WASM)** for all planetary calculations.

### Initialization
The engine must be initialized before use to load the WASM binary.

```typescript
import { EphemerisEngine } from '@node-jhora/core';

const eph = EphemerisEngine.getInstance();
await eph.initialize(); // Loads WASM
```

### Planetary Positions
Supports Sidereal (Vedic) and Tropical calculations with optional **Topocentric Parallax** correction.

```typescript
const date = DateTime.now();
const location = { latitude: 13.08, longitude: 80.27 }; // Chennai

// getPlanets(date, location?, ayanamsaOrder?, topocentric?)
const planets = eph.getPlanets(date, location, 1, true);
```

**Planet IDs:**
- `0`: Sun
- `1`: Moon
- `2`: Mercury
- `3`: Venus
- `4`: Mars
- `5`: Jupiter
- `6`: Saturn
- `11`: Rahu (Mean Node)
- `99`: Ketu (Calculated as Rahu + 180°)

### Ayanamsa Support
Standard Sidereal modes available:
- `1`: Lahiri (Chitra Paksha)
- `3`: Raman
- `5`: Krishnamurti (KP)

---

## 🧭 Geocoder

A high-performance, stream-based city lookup tool. It uses a local CSV database to find coordinates and timezones.

```typescript
import { Geocoder } from '@node-jhora/core';

const geo = new Geocoder();
const cities = await geo.search('Chennai');
// Returns: { name, latitude, longitude, timezone, country }
```

---

## 📐 Vedic Math & Fundamentals

### Angular Normalization
Ensures all angles stay within the `[0, 360)` range, handling negative inputs and large overflows correctly.
```typescript
import { normalize360 } from '@node-jhora/core';
normalize360(370); // 10
normalize360(-10); // 350
```

### Panchanga (The Five Limbs)
Calculates Tithi, Nakshatra, Yoga, Karana, and Vara based on Sun and Moon positions.
```typescript
import { calculatePanchanga } from '@node-jhora/core';
const results = calculatePanchanga(sunLon, moonLon, date);
```

### Divisional Charts (Vargas)
Calculates positions in any of the 16 standard Parashara Vargas.
```typescript
import { calculateVarga } from '@node-jhora/core';
// D9 (Navamsa)
const navamsa = calculateVarga(planetLon, 9); 
```

---

## 📡 Planetary Stream

For real-time applications (e.g., a "ticker" or Prashna UI), use the `PlanetaryStream` to receive updates at a fixed interval.

```typescript
const stream = client.createStream(1000); // 1 second interval
stream.on('data', (chart) => {
    console.log("Current Ascendant:", chart.houses.ascendant);
});
stream.start();
```
